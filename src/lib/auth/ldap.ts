import { logger } from "@/lib/logger";

interface LdapUser {
  email: string;
  name: string;
}

export async function authenticateLdap(identifier: string, password: string): Promise<LdapUser | null> {
  const ldapUrl = process.env.LDAP_URL;
  const bindDn = process.env.LDAP_BIND_DN;
  const bindPassword = process.env.LDAP_BIND_PASSWORD;
  const searchBase = process.env.LDAP_SEARCH_BASE;
  const searchFilter = process.env.LDAP_SEARCH_FILTER || "(uid={{identifier}})";

  // Si les variables LDAP ne sont pas configurées, LDAP est désactivé
  if (!ldapUrl || !bindDn || !bindPassword || !searchBase) {
    logger.info("LDAP disabled (missing env vars)", { ldapUrl: !!ldapUrl, bindDn: !!bindDn, searchBase: !!searchBase });
    return null;
  }

  logger.info("LDAP auth attempt", { identifier, ldapUrl, searchBase });

  const ldap = await import("ldapjs");
  const client = ldap.createClient({
    url: ldapUrl,
    connectTimeout: 5000,
    timeout: 5000,
  });

  // Capturer les erreurs asynchrones du client (DNS, connexion refusée, etc.)
  // Sans ce handler, l'erreur devient un uncaughtException qui crash le process
  client.on("error", (err) => {
    logger.error("LDAP client async error", { error: err instanceof Error ? err.message : String(err) });
  });

  try {
    // Bind avec le service account
    logger.info("LDAP service bind", { bindDn });
    await new Promise<void>((resolve, reject) => {
      client.bind(bindDn, bindPassword, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    logger.info("LDAP service bind OK");

    // Rechercher l'utilisateur
    const filter = searchFilter.replace("{{identifier}}", identifier);
    logger.info("LDAP search", { searchBase, filter });
    const searchResult = await new Promise<LdapUser | null>((resolve, reject) => {
      client.search(searchBase, { filter, scope: "sub", attributes: ["mail", "cn", "displayName", "uid"] }, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        let user: LdapUser | null = null;

        res.on("searchEntry", (entry) => {
          const attrs = entry.pojo.attributes;
          logger.info("LDAP entry found", { attributes: attrs.map((a) => ({ type: a.type, values: a.values })) });
          const mailAttr = attrs.find((a) => a.type === "mail");
          const nameAttr = attrs.find((a) => a.type === "displayName") || attrs.find((a) => a.type === "cn");
          // Utiliser l'email LDAP si disponible, sinon l'identifiant fourni
          const email = mailAttr
            ? (Array.isArray(mailAttr.values) ? mailAttr.values[0] : String(mailAttr.values))
            : identifier;
          user = {
            email,
            name: nameAttr ? (Array.isArray(nameAttr.values) ? nameAttr.values[0] : String(nameAttr.values)) : identifier,
          };
        });

        res.on("error", reject);
        res.on("end", () => resolve(user));
      });
    });

    if (!searchResult) {
      logger.warn("LDAP user not found", { identifier, filter });
      client.destroy();
      return null;
    }

    logger.info("LDAP user found", { email: searchResult.email, name: searchResult.name });

    // Rechercher le DN de l'utilisateur pour le bind
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
      logger.warn("LDAP DN not found", { identifier });
      client.destroy();
      return null;
    }

    logger.info("LDAP user bind attempt", { userDn });

    // Vérifier le password de l'utilisateur
    await new Promise<void>((resolve, reject) => {
      client.bind(userDn, password, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    logger.info("LDAP auth successful", { identifier, email: searchResult.email });
    client.destroy();
    return searchResult;
  } catch (e) {
    logger.error("LDAP auth failed", { identifier, error: e instanceof Error ? e.message : String(e) });
    try { client.destroy(); } catch { /* ignore */ }
    return null;
  }
}
