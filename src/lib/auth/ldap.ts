interface LdapUser {
  email: string;
  name: string;
}

export async function authenticateLdap(email: string, password: string): Promise<LdapUser | null> {
  const ldapUrl = process.env.LDAP_URL;
  const bindDn = process.env.LDAP_BIND_DN;
  const bindPassword = process.env.LDAP_BIND_PASSWORD;
  const searchBase = process.env.LDAP_SEARCH_BASE;
  const searchFilter = process.env.LDAP_SEARCH_FILTER || "(mail={{email}})";

  // Si les variables LDAP ne sont pas configurées, LDAP est désactivé
  if (!ldapUrl || !bindDn || !bindPassword || !searchBase) {
    return null;
  }

  try {
    // Dynamic import pour ne charger ldapjs que quand LDAP est configuré
    const ldap = await import("ldapjs");
    const client = ldap.createClient({ url: ldapUrl });

    // Bind avec le service account
    await new Promise<void>((resolve, reject) => {
      client.bind(bindDn, bindPassword, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Rechercher l'utilisateur
    const filter = searchFilter.replace("{{email}}", email);
    const searchResult = await new Promise<LdapUser | null>((resolve, reject) => {
      client.search(searchBase, { filter, scope: "sub", attributes: ["mail", "cn", "displayName"] }, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        let user: LdapUser | null = null;

        res.on("searchEntry", (entry) => {
          const attrs = entry.pojo.attributes;
          const mailAttr = attrs.find((a) => a.type === "mail");
          const nameAttr = attrs.find((a) => a.type === "displayName") || attrs.find((a) => a.type === "cn");
          if (mailAttr) {
            user = {
              email: Array.isArray(mailAttr.values) ? mailAttr.values[0] : String(mailAttr.values),
              name: nameAttr ? (Array.isArray(nameAttr.values) ? nameAttr.values[0] : String(nameAttr.values)) : email,
            };
          }
        });

        res.on("error", reject);
        res.on("end", () => resolve(user));
      });
    });

    if (!searchResult) {
      client.destroy();
      return null;
    }

    // Bind avec les credentials de l'utilisateur pour vérifier le mot de passe
    // On refait une recherche pour obtenir le DN
    const userDn = await new Promise<string | null>((resolve, reject) => {
      client.search(searchBase, { filter, scope: "sub", attributes: ["dn"] }, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        let dn: string | null = null;
        res.on("searchEntry", (entry) => {
          dn = entry.pojo.objectName;
        });
        res.on("error", reject);
        res.on("end", () => resolve(dn));
      });
    });

    if (!userDn) {
      client.destroy();
      return null;
    }

    // Vérifier le password de l'utilisateur
    await new Promise<void>((resolve, reject) => {
      client.bind(userDn, password, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    client.destroy();
    return searchResult;
  } catch {
    return null;
  }
}
