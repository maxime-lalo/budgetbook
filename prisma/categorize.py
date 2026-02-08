#!/usr/bin/env python3
"""
Categorize uncategorized transactions based on label patterns.
Reads and updates prisma/data/transactions-bnp.json in place.
"""

import json
import os
import re

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# Pattern rules: processed in order, first match wins.
# Each rule: (match_type, pattern, category, subcategory_or_None)
# match_type: "exact", "startswith", "contains", "regex"

EXACT_RULES = {
    # --- Rentrée ---
    "Salaire": ("Rentrée", "Salaire"),
    "APL": ("Rentrée", "Autre"),
    "Intéressement": ("Rentrée", "Salaire"),
    "Intérêts": ("Rentrée", "Autre"),
    "Régulation Salaire": ("Rentrée", "Salaire"),
    "caf": ("Aide", None),
    "Caf compte pas": ("Aide", None),
    "CAF compte pas": ("Aide", None),
    "Caf ???": ("Aide", None),
    "Ameli": ("Santé", "Médecin"),

    # --- Abonnements ---
    "Comissions banque": ("Abonnements", "Foyer"),
    "Forfait Orange": ("Abonnements", "Téléphonie"),
    "Forfait téléphone": ("Abonnements", "Téléphonie"),
    "Box Internet": ("Abonnements", "Foyer"),
    "Spotify": ("Abonnements", "Loisirs"),
    "Fitness Park": ("Abonnements", "Loisirs"),
    "OVH": ("Abonnements", "Loisirs"),
    "Canal": ("Abonnements", "Loisirs"),
    "Dashlane": ("Abonnements", "Loisirs"),
    "Crunchyroll": ("Abonnements", "Loisirs"),
    "Navigo": ("Abonnements", "Transports"),
    "ImagineR": ("Abonnements", "Transports"),
    "imagineR": ("Abonnements", "Transports"),
    "Agios": ("Abonnements", "Foyer"),
    "Patreon": ("Abonnements", "Loisirs"),
    "Tinder": ("Autre", "Autre"),
    "Happn premier mois gratuit": ("Autre", "Autre"),
    "Fruitz": ("Autre", "Autre"),
    "Grindr": ("Autre", "Autre"),
    "Wyylde": ("Autre", "Autre"),

    # --- Foyer ---
    "Loyer": ("Foyer", "Loyer"),
    "Électricité": ("Foyer", "Electricité"),
    "EDF": ("Foyer", "Electricité"),
    "EDF ancien contrat": ("Foyer", "Electricité"),
    "Assurance habitation": ("Foyer", "Abonnements"),
    "Assurance Macif": ("Foyer", "Abonnements"),

    # --- Alimentation ---
    "Captain Marcel": ("Alimentation", "Resto"),
    "Uber Eats": ("Alimentation", "Resto"),
    "Domac": ("Alimentation", "Resto"),
    "Pizzas": ("Alimentation", "Resto"),
    "Pizza": ("Alimentation", "Resto"),
    "Mcdo": ("Alimentation", "Resto"),
    "Tacos": ("Alimentation", "Resto"),
    "Spar": ("Alimentation", "Courses"),
    "Cajoo": ("Alimentation", "Courses"),
    "Subway": ("Alimentation", "Resto"),
    "Ramen": ("Alimentation", "Resto"),
    "Five": ("Alimentation", "Resto"),
    "Makis": ("Alimentation", "Resto"),
    "Boulangerie": ("Alimentation", "Resto"),
    "Monoprix": ("Alimentation", "Courses"),
    "Franprix": ("Alimentation", "Courses"),
    "Lidl": ("Alimentation", "Courses"),
    "Supermarché": ("Alimentation", "Courses"),
    "Casino": ("Alimentation", "Courses"),
    "Inter": ("Alimentation", "Courses"),
    "Courses": ("Alimentation", "Courses"),
    "Monop": ("Alimentation", "Courses"),

    # --- Economies ---
    "Economies": ("Economies", "Ajout"),
    "Économies": ("Economies", "Ajout"),
    "Binance": ("Crypto", None),
    "Coinbase": ("Crypto", None),
    "Crypto": ("Crypto", None),
    "Swissborg": ("Crypto", None),
    "Kraken": ("Crypto", None),

    # --- Santé ---
    "Coiffeur": ("Santé", "Hygiène"),
    "Pharmacie": ("Santé", "Médicaments"),
    "Médecin": ("Santé", "Médecin"),
    "Docteur": ("Santé", "Médecin"),
    "Psy": ("Santé", "Médecin"),
    "Chiro": ("Santé", "Médecin"),
    "Cardiologue": ("Santé", "Médecin"),
    "Allergologue": ("Santé", "Médecin"),
    "ORL": ("Santé", "Médecin"),
    "Cardio": ("Santé", "Médecin"),
    "Lunettes": ("Santé", "Médecin"),
    "Médicaments": ("Santé", "Médicaments"),
    "Medicaments": ("Santé", "Médicaments"),

    # --- Sorties ---
    "Bowling": ("Sorties", "Autre"),
    "Essence": ("Sorties", "Transport"),
    "Train": ("Sorties", "Transport"),
    "Péage": ("Sorties", "Transport"),
    "Pogo": ("Loisirs", "Jeux vidéo"),
    "Boursorama": ("Autre", "Autre"),
    "Dofus": ("Loisirs", "Jeux vidéo"),
    "DECA": ("Loisirs", "Jeux vidéo"),
    "Realm": ("Loisirs", "Jeux vidéo"),
    "Rotmg": ("Loisirs", "Jeux vidéo"),
    "rotmg": ("Loisirs", "Jeux vidéo"),
    "ROTMG": ("Loisirs", "Jeux vidéo"),
    "Player One": ("Loisirs", "Jeux vidéo"),
    "Unibet": ("Loisirs", "Jeux vidéo"),
    "Tatouage": ("Autre", "Autre"),
    "Tabac": ("Autre", "Autre"),
    "Parfum": ("Courses autre", "Hygiène"),
    "Gel": ("Courses autre", "Hygiène"),
    "Amazon": ("Autre", "Autre"),
    "Paypal": ("Autre", "Autre"),
    "Lydia": ("Autre", "Autre"),
    "Pumpkin": ("Autre", "Autre"),
    "Chaussures": ("Vêtements", "Chaussures"),

    # --- Loisirs ---
    "Cultura": ("Loisirs", "Petit plaisir"),
    "Fnac": ("Loisirs", "Petit plaisir"),

    # --- Aide ---
    "Maman": ("Aide", None),
    "Mamie": ("Aide", None),

    # Misc
    "Retrait espèces": ("Autre", "Autre"),
    "Retrait": ("Autre", "Autre"),
    "Avance": ("Autre", "Autre"),
    "Galère": ("Autre", "Autre"),
    "???": ("Autre", "Autre"),
    "????": ("Autre", "Autre"),
    "Jsp": ("Autre", "Autre"),

    # --- Remaining uncategorized labels (round 2) ---

    # Alimentation / Resto
    "Jap": ("Alimentation", "Resto"),
    "BK": ("Alimentation", "Resto"),
    "Bk": ("Alimentation", "Resto"),
    "Swile dépassement": ("Alimentation", "Resto"),
    "Dépassement Swile": ("Alimentation", "Resto"),
    "Avocado restaurant": ("Alimentation", "Resto"),
    "Cibus Pizzeria": ("Alimentation", "Resto"),
    "Le comptoir du malt": ("Alimentation", "Resto"),
    "Little Italy Factory": ("Alimentation", "Resto"),
    "Lu Fran Calin Resto": ("Alimentation", "Resto"),
    "Mangez et cassez vous": ("Alimentation", "Resto"),
    "Paneolio Resto": ("Alimentation", "Resto"),
    "Pizzeria Cyrano": ("Alimentation", "Resto"),
    "Pizzeria avec Manon Léo": ("Alimentation", "Resto"),
    "California": ("Alimentation", "Resto"),
    "Mademoiselle": ("Alimentation", "Resto"),
    "Sylvia avec Manon et Lucas": ("Alimentation", "Resto"),
    "Deuxieme petit dej": ("Alimentation", "Resto"),
    "Collation 05/07": ("Alimentation", "Resto"),
    "Riz repas midi": ("Alimentation", "Resto"),
    "Hema gauffres": ("Alimentation", "Resto"),
    "Churros Waterworld": ("Alimentation", "Resto"),
    "Cocktails piscine": ("Alimentation", "Resto"),
    "Pool party cocktail": ("Alimentation", "Resto"),
    "Eau pool party": ("Alimentation", "Resto"),
    "Picnic sur la plage": ("Alimentation", "Resto"),
    "Smoothie en bord de mer": ("Alimentation", "Resto"),
    "Chicha sur la plage": ("Alimentation", "Resto"),
    "Lindor": ("Alimentation", "Resto"),
    "Snack ??": ("Alimentation", "Resto"),
    "Machine Selecta avec Raph": ("Alimentation", "Resto"),
    "Selecta": ("Alimentation", "Resto"),
    "Selecta gare": ("Alimentation", "Resto"),
    "Selecta gdn": ("Alimentation", "Resto"),
    "Relais CDG": ("Alimentation", "Resto"),
    "Relais aéroport": ("Alimentation", "Resto"),
    "Gateaux et boissons aéroport": ("Alimentation", "Resto"),
    "Boisson en revenant de chez pas ou": ("Alimentation", "Resto"),
    "Mountain Dew": ("Alimentation", "Resto"),
    "Jus de pomme Damien": ("Alimentation", "Resto"),
    "San pé a la gare": ("Alimentation", "Resto"),
    "Scwheppes GDN": ("Alimentation", "Resto"),
    "Eau aéroport": ("Alimentation", "Resto"),
    "Evian aéroport": ("Alimentation", "Resto"),
    "Saucissons Chope Moi": ("Alimentation", "Resto"),
    "Saucissons aux 4 temps": ("Alimentation", "Resto"),

    # Alimentation / Courses
    "Jambon": ("Alimentation", "Courses"),
    "Fromage croques & pack d'eau": ("Alimentation", "Courses"),
    "Fromage pour les darons": ("Alimentation", "Courses"),
    "Bouteille d'eau Spar": ("Alimentation", "Courses"),
    "Bouteille oasis gare": ("Alimentation", "Courses"),
    "Eau Monop": ("Alimentation", "Courses"),
    "PQ Eau Monop": ("Alimentation", "Courses"),
    "Monop sacs poub + éponges": ("Alimentation", "Courses"),
    "Franprix Luis": ("Alimentation", "Courses"),
    "Inter Greg": ("Alimentation", "Courses"),
    "Inter greg": ("Alimentation", "Courses"),
    "Inter pour les parents": ("Alimentation", "Courses"),
    "Produits Japonais": ("Alimentation", "Courses"),
    "Produits japonais": ("Alimentation", "Courses"),
    "Les halles ?": ("Alimentation", "Courses"),
    "Sel de pépé là": ("Alimentation", "Courses"),
    "Piles + sandwich": ("Alimentation", "Courses"),

    # Sorties / Soirée
    "Boîte de nuit": ("Sorties", "Soirée"),
    "Disco tropics": ("Sorties", "Soirée"),
    "Maison close amstedam": ("Sorties", "Soirée"),
    "Fête sensation halloween": ("Sorties", "Soirée"),
    "Bouteille Duty Free": ("Sorties", "Soirée"),
    "Bouteilles Nicolas": ("Sorties", "Soirée"),
    "Gobelets Intermarché": ("Sorties", "Soirée"),
    "Gorillas Apéro": ("Sorties", "Soirée"),
    "Monop nouvel an": ("Sorties", "Soirée"),
    "Fromage crémaillère": ("Sorties", "Soirée"),
    "Salle Damien": ("Sorties", "Soirée"),
    "Salle Max": ("Sorties", "Soirée"),
    "WEI Max": ("Sorties", "Soirée"),
    "WEI Raph": ("Sorties", "Soirée"),

    # Sorties / Bar
    "Blue bar": ("Sorties", "Bar"),
    "Pichet match": ("Sorties", "Bar"),

    # Sorties / Autre
    "Boissons acrobranche": ("Sorties", "Autre"),
    "Billets possession": ("Sorties", "Autre"),
    "Moco museum": ("Sorties", "Autre"),
    "Musée de la frite": ("Sorties", "Autre"),
    "Musée de la torture": ("Sorties", "Autre"),
    "Aquarium": ("Sorties", "Autre"),
    "Aquarium La Rochelle": ("Sorties", "Autre"),
    "Aquarium bis ???": ("Sorties", "Autre"),
    "Boutique Aquarium La Rochelle": ("Sorties", "Autre"),
    "Jack pépinièrades": ("Sorties", "Autre"),
    "Participation pépinièrades": ("Sorties", "Autre"),
    "Swile UGC Popcorn": ("Sorties", "Autre"),
    "Salon du tatouage": ("Sorties", "Autre"),

    # Sorties / Transport
    "Creil Paris": ("Sorties", "Transport"),
    "Orry Creil": ("Sorties", "Transport"),
    "Gare du nord avec Luis": ("Sorties", "Transport"),
    "Bateau 10/11": ("Sorties", "Transport"),
    "Transports Meda": ("Sorties", "Transport"),
    "Twingo Garage": ("Sorties", "Transport"),
    "Voiture": ("Sorties", "Transport"),
    "Aéroport tillé ?": ("Sorties", "Transport"),

    # Voyages
    "Talmont": ("Voyages", "Autre"),
    "St Trop": ("Voyages", "Autre"),
    "Tokyo": ("Voyages", "Autre"),
    "Tapis de plage": ("Voyages", "Autre"),
    "Pèse bagage N&D": ("Voyages", "Autre"),
    "Livret AirBnB": ("Voyages", "Hebergement"),
    "Annulation staycation": ("Voyages", "Hebergement"),
    "The upside down meda": ("Voyages", "Activité"),
    "CDG Duty Free": ("Voyages", "Autre"),
    "Fuet duty free": ("Voyages", "Autre"),
    "M&S Paris": ("Voyages", "Autre"),

    # Loisirs / Jeux vidéo
    "DLC Smash": ("Loisirs", "Jeux vidéo"),
    "Accessoires Switch": ("Loisirs", "Jeux vidéo"),
    "Kit réparation Switch": ("Loisirs", "Jeux vidéo"),
    "Grip joycons": ("Loisirs", "Jeux vidéo"),
    "Étui transport Switch": ("Loisirs", "Jeux vidéo"),
    "R4 DS": ("Loisirs", "Jeux vidéo"),
    "Steam ???": ("Loisirs", "Jeux vidéo"),
    "Bga": ("Loisirs", "Jeux vidéo"),

    # Loisirs / Informatique
    "Carte SD": ("Loisirs", "Informatique"),
    "Cartes sd": ("Loisirs", "Informatique"),
    "Ecouteurs Cams": ("Loisirs", "Informatique"),
    "Écouteurs": ("Loisirs", "Informatique"),
    "Mousse écouteurs": ("Loisirs", "Informatique"),
    "Pied écrans": ("Loisirs", "Informatique"),
    "Kit démarrage Arduino": ("Loisirs", "Informatique"),
    "Transmetteur FM bluetooth": ("Loisirs", "Informatique"),
    "Verre Trempé Téléphone": ("Loisirs", "Informatique"),

    # Loisirs / Petit plaisir
    "JJK Zero": ("Loisirs", "Petit plaisir"),
    "Re picsou": ("Loisirs", "Petit plaisir"),
    "Peluche raie": ("Loisirs", "Petit plaisir"),
    "Piti peluche sultan": ("Loisirs", "Petit plaisir"),
    "Commande memes décentralisés": ("Loisirs", "Petit plaisir"),

    # Abonnements / Loisirs
    "Connards de Patreon": ("Abonnements", "Loisirs"),
    "Renouvellement automatique ADN": ("Abonnements", "Loisirs"),
    "Renouvellement automatique Nintendo": ("Abonnements", "Loisirs"),
    "Renouvellement OVH": ("Abonnements", "Loisirs"),
    "Hébergement web": ("Abonnements", "Loisirs"),
    "Nom de domaine eplp.fr": ("Abonnements", "Loisirs"),
    "Noms de domaine OVH": ("Abonnements", "Loisirs"),
    "Probiller ?": ("Abonnements", "Loisirs"),
    "Essai Fitness Park": ("Abonnements", "Loisirs"),

    # Abonnements / Transports
    "Fail abonnement travail": ("Abonnements", "Transports"),
    "Erreur imagine R": ("Abonnements", "Transports"),

    # Santé
    "Trousse de premiers soins": ("Santé", "Médicaments"),
    "Masques": ("Santé", "Médicaments"),
    "Eau Dakin": ("Santé", "Médicaments"),
    "Coupe ongle": ("Santé", "Hygiène"),
    "Teinture avec Dam1": ("Santé", "Hygiène"),
    "Huile de massage": ("Santé", "Hygiène"),

    # Foyer / Meuble
    "Commande IKEA": ("Foyer", "Meuble"),
    "Meuble SDB Cdiscount": ("Foyer", "Meuble"),

    # Foyer / Objets
    "Appareil à raclette": ("Foyer", "Objets"),
    "Balance cuisine": ("Foyer", "Objets"),
    "Presse ail": ("Foyer", "Objets"),
    "Rape à fromage": ("Foyer", "Objets"),
    "Plaques paninis": ("Foyer", "Objets"),
    "Poignées poêles": ("Foyer", "Objets"),
    "Brosse à toilettes": ("Foyer", "Objets"),
    "Tuyau machine à laver": ("Foyer", "Objets"),
    "Défroisseur": ("Foyer", "Objets"),
    "Alèses matelas": ("Foyer", "Objets"),
    "Vente privée Duralex": ("Foyer", "Objets"),
    "Gamm Vert": ("Foyer", "Objets"),
    "Double face": ("Foyer", "Objets"),

    # Foyer / Loyer
    "Appart": ("Foyer", "Loyer"),
    "Frais virement Loyer": ("Foyer", "Loyer"),

    # Cadeau
    "Chocolats maman": ("Cadeau", "Autre"),
    "Roses Lauryne": ("Cadeau", "Couple"),
    "Graines pour Steph": ("Cadeau", "Autre"),
    "Gâteau Damien": ("Cadeau", "Anniversaire"),
    "Binder Amandine": ("Cadeau", "Autre"),

    # Aide
    "Pour Alex": ("Aide", None),
    "Pour Léo": ("Aide", None),
    "Léo": ("Aide", None),
    "Erreur maman": ("Aide", None),
    "Retour de plage maman": ("Aide", None),
    "Tante Juliette": ("Aide", None),

    # Vêtements
    "Commande Showroomprive": ("Vêtements", "Vêtements"),
    "Accessoires Halloween": ("Vêtements", "Vêtements"),

    # Sport / Loisirs
    "Affaires badminton": ("Loisirs", "Autre"),
    "Équipement Badminton": ("Loisirs", "Autre"),
    "Barre de tractions": ("Loisirs", "Autre"),

    # Autre / Autre
    "Arnaque Darty": ("Autre", "Autre"),
    "Darty ?": ("Autre", "Autre"),
    "??? Blanco Y Negro": ("Autre", "Autre"),
    "Microsoft ???": ("Autre", "Autre"),
    "Orange ???": ("Autre", "Autre"),
    "Thiais???": ("Autre", "Autre"),
    "Ouaient": ("Autre", "Autre"),
    "Tkt": ("Autre", "Autre"),
    "Ta mère en slip": ("Autre", "Autre"),
    "Equilibrage nsm": ("Autre", "Autre"),
    "La poste": ("Autre", "Autre"),
    "Recommandé Sébastien": ("Autre", "Autre"),
    "Revolut": ("Autre", "Autre"),
    "Avance Raph Halloween": ("Autre", "Autre"),
    "Tenga Eggs": ("Autre", "Autre"),
    "Fail Dorcel": ("Autre", "Autre"),
    "OkCupid seum": ("Autre", "Autre"),
    "Boost okc": ("Autre", "Autre"),
    "Badoo fail": ("Autre", "Autre"),
    "Numéro virtuel qui marche pas": ("Autre", "Autre"),
    "TradingView enculé": ("Autre", "Autre"),
    "Probablement okc": ("Autre", "Autre"),
    "CBD": ("Autre", "Autre"),
    "Tabac pour Marin": ("Autre", "Autre"),
    "Paquet de clopes Raph": ("Autre", "Autre"),
    "Jimmy Lidya": ("Autre", "Autre"),
    "Réparation sac": ("Autre", "Autre"),
    "Réparation tel acompte": ("Autre", "Autre"),
    "Réparation tel fin": ("Autre", "Autre"),
    "Ouverture Livret A": ("Autre", "Autre"),
    "Atelier de Julien": ("Autre", "Autre"),

    # Foyer / Electricité (misc)
    "Commande carte": ("Autre", "Autre"),

    # Animaux
    "Peluche raie": ("Loisirs", "Petit plaisir"),  # override above if not animal

    # Courses autre / Hygiène
    "Protège écran": ("Loisirs", "Informatique"),
}

# Prefix rules (startswith, case-insensitive)
PREFIX_RULES = [
    # Rentrée (income)
    ("salaire", "Rentrée", "Salaire"),
    ("prime d'activité", "Rentrée", "Salaire"),
    ("prime d'activité", "Rentrée", "Salaire"),
    ("prime lcl", "Rentrée", "Salaire"),
    ("prime ", "Rentrée", "Salaire"),
    ("pension", "Rentrée", "Autre"),
    ("apl", "Rentrée", "Autre"),
    ("lcl interessement", "Rentrée", "Salaire"),
    ("intéressement", "Rentrée", "Salaire"),
    ("régulation", "Rentrée", "Salaire"),
    ("dépôt", "Rentrée", "Autre"),
    ("chèque", "Rentrée", "Autre"),
    ("chèques", "Rentrée", "Autre"),

    # Remboursements → Rentrée/Autre (money coming back)
    ("remboursement", "Rentrée", "Autre"),
    ("rbmt", "Rentrée", "Autre"),
    ("rb ", "Rentrée", "Autre"),
    ("récupération", "Economies", "Retrait"),
    ("recup ", "Economies", "Retrait"),
    ("reprise économies", "Economies", "Retrait"),
    ("retrait économies", "Economies", "Retrait"),
    ("retrait eco", "Economies", "Retrait"),
    ("renflouement", "Economies", "Retrait"),
    ("argent livret", "Economies", "Retrait"),

    # Economies
    ("economies", "Economies", "Ajout"),
    ("économies", "Economies", "Ajout"),
    ("epargne", "Economies", "Ajout"),
    ("avance économies", "Economies", "Ajout"),
    ("galère économies", "Economies", "Retrait"),
    ("aide économies", "Economies", "Retrait"),
    ("téléphone économies", "Economies", "Retrait"),
    ("récupération économies", "Economies", "Retrait"),
    ("récupération livret", "Economies", "Retrait"),
    ("récupération sous", "Economies", "Retrait"),

    # Virement (transfers)
    ("virement", "Autre", "Autre"),

    # Crypto
    ("binance", "Crypto", None),
    ("coinbase", "Crypto", None),
    ("crypto", "Crypto", None),
    ("papa crypto", "Crypto", None),
    ("papa binance", "Crypto", None),

    # Abonnements
    ("abonnement train", "Abonnements", "Transports"),
    ("abonnements train", "Abonnements", "Transports"),
    ("abonnements sncf", "Abonnements", "Transports"),
    ("abonnement sncf", "Abonnements", "Transports"),
    ("abonnement ter", "Abonnements", "Transports"),
    ("abonnement navigo", "Abonnements", "Transports"),
    ("abonnement imaginer", "Abonnements", "Transports"),
    ("imagine r", "Abonnements", "Transports"),
    ("imaginer", "Abonnements", "Transports"),
    ("navigo", "Abonnements", "Transports"),
    ("comissions banque", "Abonnements", "Foyer"),
    ("forfait orange", "Abonnements", "Téléphonie"),
    ("forfait tél", "Abonnements", "Téléphonie"),
    ("forfait tel", "Abonnements", "Téléphonie"),
    ("crédit téléphone", "Abonnements", "Téléphonie"),
    ("carte sim", "Abonnements", "Téléphonie"),
    ("résiliation", "Abonnements", "Téléphonie"),
    ("box internet", "Abonnements", "Foyer"),
    ("spotify", "Abonnements", "Loisirs"),
    ("abonnement spotify", "Abonnements", "Loisirs"),
    ("abonnement canal", "Abonnements", "Loisirs"),
    ("abonnement cinéma", "Abonnements", "Loisirs"),
    ("abonnement dofus", "Abonnements", "Loisirs"),
    ("abnonnement dofus", "Abonnements", "Loisirs"),
    ("abonnement panda", "Abonnements", "Loisirs"),
    ("abonnement adn", "Abonnements", "Loisirs"),
    ("abonnement prime", "Abonnements", "Loisirs"),
    ("amazon prime", "Abonnements", "Loisirs"),
    ("abonnement google", "Abonnements", "Loisirs"),
    ("abonnement drive", "Abonnements", "Loisirs"),
    ("abonnement dashlane", "Abonnements", "Loisirs"),
    ("abonnement switch", "Abonnements", "Loisirs"),
    ("abonnement nintendo", "Abonnements", "Loisirs"),
    ("abonnement bga", "Abonnements", "Loisirs"),
    ("abonnement business", "Abonnements", "Loisirs"),
    ("abonnement mario", "Abonnements", "Loisirs"),
    ("abonnement probiller", "Abonnements", "Loisirs"),
    ("abonnement yanga", "Abonnements", "Loisirs"),
    ("abonnement eipg", "Abonnements", "Loisirs"),
    ("abonnement annuel", "Abonnements", "Loisirs"),
    ("abonnement travail", "Abonnements", "Transports"),
    ("fitness park", "Abonnements", "Loisirs"),
    ("ovh", "Abonnements", "Loisirs"),
    ("vps ovh", "Abonnements", "Loisirs"),
    ("agios", "Abonnements", "Foyer"),
    ("disney plus", "Abonnements", "Loisirs"),
    ("netflix", "Abonnements", "Loisirs"),
    ("crunchyroll", "Abonnements", "Loisirs"),
    ("dashlane", "Abonnements", "Loisirs"),
    ("patreon", "Abonnements", "Loisirs"),
    ("udemy", "Abonnements", "Loisirs"),
    ("xbox game", "Abonnements", "Loisirs"),
    ("game pass", "Abonnements", "Loisirs"),

    # Foyer
    ("loyer", "Foyer", "Loyer"),
    ("électricité", "Foyer", "Electricité"),
    ("edf", "Foyer", "Electricité"),
    ("assurance hab", "Foyer", "Abonnements"),
    ("assurance macif", "Foyer", "Abonnements"),
    ("assurance maladie", "Foyer", "Abonnements"),

    # Alimentation - Courses (grocery shopping)
    ("courses lid", "Alimentation", "Courses"),
    ("courses leclerc", "Alimentation", "Courses"),
    ("courses monop", "Alimentation", "Courses"),
    ("courses auchan", "Alimentation", "Courses"),
    ("courses carrefour", "Alimentation", "Courses"),
    ("courses casino", "Alimentation", "Courses"),
    ("courses drive", "Alimentation", "Courses"),
    ("courses inter", "Alimentation", "Courses"),
    ("courses spar", "Alimentation", "Courses"),
    ("courses naturéo", "Alimentation", "Courses"),
    ("courses gorillas", "Alimentation", "Courses"),
    ("courses cajoo", "Alimentation", "Courses"),
    ("courses g20", "Alimentation", "Courses"),
    ("courses appart", "Alimentation", "Courses"),
    ("courses maison", "Alimentation", "Courses"),
    ("courses semaine", "Alimentation", "Courses"),
    ("courses deliveroo", "Alimentation", "Courses"),
    ("courses perso", "Alimentation", "Courses"),
    ("courses pré", "Alimentation", "Courses"),
    ("courses chez", "Alimentation", "Courses"),
    ("courses avec", "Alimentation", "Courses"),
    ("courses cams", "Alimentation", "Courses"),
    ("courses didine", "Alimentation", "Courses"),
    ("courses pour", "Alimentation", "Courses"),
    ("courses a l", "Alimentation", "Courses"),
    ("courses à l", "Alimentation", "Courses"),
    ("courses nice", "Alimentation", "Courses"),
    ("courses chauny", "Alimentation", "Courses"),
    ("leclerc", "Alimentation", "Courses"),
    ("drive leclerc", "Alimentation", "Courses"),
    ("carrefour", "Alimentation", "Courses"),
    ("pemières courses", "Alimentation", "Courses"),
    ("premières courses", "Alimentation", "Courses"),
    ("liddl", "Alimentation", "Courses"),
    ("lidl", "Alimentation", "Courses"),
    ("petites courses", "Alimentation", "Courses"),

    # Alimentation - Resto (restaurants, fast food, delivery)
    ("recharge bouffe", "Alimentation", "Resto"),
    ("rechargement captain", "Alimentation", "Resto"),
    ("recharge captain", "Alimentation", "Resto"),
    ("recharge clef", "Alimentation", "Resto"),
    ("captain marcel", "Alimentation", "Resto"),
    ("captain ", "Alimentation", "Resto"),
    ("captain", "Alimentation", "Resto"),
    ("uber eats", "Alimentation", "Resto"),
    ("deliveroo", "Alimentation", "Resto"),
    ("just eat", "Alimentation", "Resto"),
    ("domac", "Alimentation", "Resto"),
    ("mcdo", "Alimentation", "Resto"),
    ("mcflurry", "Alimentation", "Resto"),
    ("mcdonald", "Alimentation", "Resto"),
    ("burger king", "Alimentation", "Resto"),
    ("bk ", "Alimentation", "Resto"),
    ("bk gdn", "Alimentation", "Resto"),
    ("kfc", "Alimentation", "Resto"),
    ("quick", "Alimentation", "Resto"),
    ("subway", "Alimentation", "Resto"),
    ("five pizza", "Alimentation", "Resto"),
    ("five w/", "Alimentation", "Resto"),
    ("five ", "Alimentation", "Resto"),
    ("pizza", "Alimentation", "Resto"),
    ("pideza", "Alimentation", "Resto"),
    ("pidezas", "Alimentation", "Resto"),
    ("tacos", "Alimentation", "Resto"),
    ("jap ", "Alimentation", "Resto"),
    ("jap avec", "Alimentation", "Resto"),
    ("jap a vol", "Alimentation", "Resto"),
    ("jap à vol", "Alimentation", "Resto"),
    ("jap papa", "Alimentation", "Resto"),
    ("jap après", "Alimentation", "Resto"),
    ("jap en sort", "Alimentation", "Resto"),
    ("jap école", "Alimentation", "Resto"),
    ("sushi", "Alimentation", "Resto"),
    ("chirashi", "Alimentation", "Resto"),
    ("ramen", "Alimentation", "Resto"),
    ("kebab", "Alimentation", "Resto"),
    ("nuggets", "Alimentation", "Resto"),
    ("too good to go", "Alimentation", "Resto"),
    ("café boulot", "Alimentation", "Resto"),
    ("repas", "Alimentation", "Resto"),
    ("petit dej", "Alimentation", "Resto"),
    ("petit déj", "Alimentation", "Resto"),
    ("p'tit déj", "Alimentation", "Resto"),
    ("ptit dej", "Alimentation", "Resto"),
    ("déjeuner", "Alimentation", "Resto"),
    ("goûter", "Alimentation", "Resto"),
    ("bouffe boulot", "Alimentation", "Resto"),
    ("encas ", "Alimentation", "Resto"),
    ("cantine", "Alimentation", "Resto"),
    ("a2pas", "Alimentation", "Resto"),
    ("starbucks", "Alimentation", "Resto"),
    ("flunch", "Alimentation", "Resto"),
    ("factory", "Alimentation", "Resto"),
    ("courtepaille", "Alimentation", "Resto"),
    ("cookie dough", "Alimentation", "Resto"),
    ("cookies", "Alimentation", "Resto"),
    ("croque monsieur", "Alimentation", "Resto"),
    ("class croute", "Alimentation", "Resto"),
    ("haagen dazs", "Alimentation", "Resto"),
    ("gauffre", "Alimentation", "Resto"),
    ("gaufre", "Alimentation", "Resto"),
    ("gauffe", "Alimentation", "Resto"),
    ("poutine", "Alimentation", "Resto"),
    ("resto", "Alimentation", "Resto"),
    ("restaurant", "Alimentation", "Resto"),
    ("little baobei", "Alimentation", "Resto"),
    ("spagho", "Alimentation", "Resto"),
    ("boulangerie", "Alimentation", "Resto"),
    ("sandwich", "Alimentation", "Resto"),
    ("dwich", "Alimentation", "Resto"),
    ("burgers", "Alimentation", "Resto"),
    ("burger", "Alimentation", "Resto"),
    ("big greedy", "Alimentation", "Resto"),
    ("raclette", "Alimentation", "Resto"),
    ("fajitas", "Alimentation", "Resto"),
    ("pepperico", "Alimentation", "Resto"),
    ("chinois", "Alimentation", "Resto"),
    ("sanoflore", "Courses autre", "Hygiène"),

    # Sorties - Soirée
    ("courses soirée", "Sorties", "Soirée"),
    ("courses soiree", "Sorties", "Soirée"),
    ("courses anniv", "Sorties", "Soirée"),
    ("courses raclette", "Sorties", "Soirée"),
    ("courses fondue", "Sorties", "Soirée"),
    ("courses mousse", "Sorties", "Soirée"),
    ("courses crémaillère", "Sorties", "Soirée"),
    ("courses makis", "Sorties", "Soirée"),
    ("courses pâtes", "Sorties", "Soirée"),
    ("courses hamburger", "Sorties", "Soirée"),
    ("courses pelouse", "Sorties", "Soirée"),
    ("courses nouvel", "Sorties", "Soirée"),
    ("courses départ", "Sorties", "Soirée"),
    ("courses casino crêpes", "Sorties", "Soirée"),
    ("courses école", "Alimentation", "Courses"),
    ("courses esgi", "Alimentation", "Resto"),
    ("courses repas", "Alimentation", "Resto"),
    ("barbecue", "Sorties", "Soirée"),
    ("soirée", "Sorties", "Soirée"),
    ("anniv ", "Sorties", "Soirée"),
    ("anniv'", "Sorties", "Soirée"),
    ("alcool", "Sorties", "Soirée"),
    ("20 ans ", "Sorties", "Soirée"),
    ("cuban", "Sorties", "Bar"),
    ("pinte", "Sorties", "Bar"),
    ("bières", "Sorties", "Bar"),
    ("jager", "Sorties", "Bar"),
    ("tournée", "Sorties", "Bar"),
    ("bar ", "Sorties", "Bar"),
    ("monster café", "Sorties", "Bar"),
    ("panam art café", "Sorties", "Bar"),
    ("bar a jeux", "Sorties", "Autre"),
    ("bar à jeux", "Sorties", "Autre"),
    ("bar a shot", "Sorties", "Bar"),
    ("bar à shot", "Sorties", "Bar"),
    ("conso ", "Sorties", "Soirée"),
    ("consos ", "Sorties", "Soirée"),

    # Sorties - Concert
    ("concert", "Sorties", "Concert"),
    ("marc rebillet", "Sorties", "Concert"),
    ("billets balcon", "Sorties", "Concert"),
    ("billets fosse", "Sorties", "Concert"),

    # Sorties - Cinéma
    ("ciné", "Sorties", "Autre"),
    ("cinéma", "Sorties", "Autre"),
    ("popcorn", "Sorties", "Autre"),
    ("boissons ugc", "Sorties", "Autre"),
    ("boissons bercy", "Sorties", "Autre"),
    ("boissons grand rex", "Sorties", "Autre"),
    ("marathon animaux", "Sorties", "Autre"),

    # Sorties - Transport ponctuel
    ("billet de train", "Sorties", "Transport"),
    ("billet ter", "Sorties", "Transport"),
    ("billets train", "Sorties", "Transport"),
    ("billets ter", "Sorties", "Transport"),
    ("billets clermont", "Sorties", "Transport"),
    ("billet chantilly", "Sorties", "Transport"),
    ("billet de métro", "Sorties", "Transport"),
    ("billet rer", "Sorties", "Transport"),
    ("billet cdg", "Sorties", "Transport"),
    ("billet retour", "Sorties", "Transport"),
    ("billet orry", "Sorties", "Transport"),
    ("billets de train", "Sorties", "Transport"),
    ("billet de bus", "Sorties", "Transport"),
    ("ticket de bus", "Sorties", "Transport"),
    ("ticket de métro", "Sorties", "Transport"),
    ("ticket de train", "Sorties", "Transport"),
    ("ticket rer", "Sorties", "Transport"),
    ("carnet de tickets", "Sorties", "Transport"),
    ("carnet tickets", "Sorties", "Transport"),
    ("carnet sncf", "Sorties", "Transport"),
    ("sncf", "Sorties", "Transport"),
    ("orly", "Sorties", "Transport"),
    ("orlybus", "Sorties", "Transport"),
    ("train ", "Sorties", "Transport"),
    ("helder train", "Sorties", "Transport"),
    ("essence", "Sorties", "Transport"),
    ("plein gpl", "Sorties", "Transport"),
    ("plein essence", "Sorties", "Transport"),
    ("plein voiture", "Sorties", "Transport"),
    ("gpl", "Sorties", "Transport"),
    ("ethanol", "Sorties", "Transport"),
    ("péage", "Sorties", "Transport"),
    ("parking", "Sorties", "Transport"),
    ("uber ", "Sorties", "Transport"),
    ("uber après", "Sorties", "Transport"),
    ("heetch", "Sorties", "Transport"),
    ("vélo lime", "Sorties", "Transport"),
    ("complément transports", "Sorties", "Transport"),
    ("aller retour", "Sorties", "Transport"),
    ("aire d'autoroute", "Sorties", "Transport"),

    # Sorties - Autre (misc outings)
    ("bowling", "Sorties", "Autre"),
    ("escape game", "Sorties", "Autre"),
    ("laser game", "Sorties", "Autre"),
    ("luna park", "Sorties", "Autre"),
    ("koezio", "Sorties", "Autre"),
    ("possession", "Sorties", "Autre"),
    ("billet possession", "Sorties", "Autre"),
    ("billard", "Sorties", "Autre"),
    ("acrobranche", "Sorties", "Autre"),

    # Cadeau
    ("kdo ", "Cadeau", "Autre"),
    ("kdo anniv", "Cadeau", "Anniversaire"),
    ("cadeau anniv", "Cadeau", "Anniversaire"),
    ("cadeau ", "Cadeau", "Autre"),
    ("cagnotte", "Cadeau", "Autre"),
    ("calendrier de l'avent", "Cadeau", "Couple"),
    ("noël ", "Cadeau", "Autre"),

    # Aide
    ("aide ", "Aide", None),
    ("aide caf", "Aide", None),
    ("aide loyer", "Aide", None),
    ("maman ", "Aide", None),
    ("sous maman", "Aide", None),
    ("papa ", "Aide", None),
    ("mamie", "Aide", None),
    ("paiement psy maman", "Aide", None),
    ("psy didine", "Aide", None),

    # Santé
    ("pharmacie", "Santé", "Médicaments"),
    ("médecin", "Santé", "Médecin"),
    ("docteur", "Santé", "Médecin"),
    ("psy ", "Santé", "Médecin"),
    ("chiro", "Santé", "Médecin"),
    ("cardio", "Santé", "Médecin"),
    ("ophtalmo", "Santé", "Médecin"),
    ("allergologue", "Santé", "Médecin"),
    ("orl", "Santé", "Médecin"),
    ("hopital", "Santé", "Médecin"),
    ("hôpital", "Santé", "Médecin"),
    ("urgences", "Santé", "Médecin"),
    ("prise de sang", "Santé", "Médecin"),
    ("lunettes", "Santé", "Médecin"),
    ("mutuelle", "Santé", "Médecin"),
    ("cpam ", "Santé", "Médecin"),
    ("alan ", "Santé", "Médecin"),
    ("ameli", "Santé", "Médecin"),
    ("anti isthaminiques", "Santé", "Médicaments"),
    ("anti histaminiques", "Santé", "Médicaments"),
    ("antiestaminiques", "Santé", "Médicaments"),
    ("antihistaminiques", "Santé", "Médicaments"),
    ("ibuprofène", "Santé", "Médicaments"),
    ("crème anti", "Santé", "Médicaments"),
    ("doliprane", "Santé", "Médicaments"),
    ("dakin", "Santé", "Médicaments"),
    ("physiomer", "Santé", "Médicaments"),
    ("coiffeur", "Santé", "Hygiène"),

    # Animaux
    ("véto", "Animaux", "Vétérinaire"),
    ("veto", "Animaux", "Vétérinaire"),
    ("vanille", "Animaux", "Autre"),
    ("feliway", "Animaux", "Autre"),
    ("croquettes", "Animaux", "Nourriture"),
    ("litière", "Animaux", "Nourriture"),
    ("pelle à merde", "Animaux", "Nourriture"),
    ("fontaine chats", "Animaux", "Autre"),
    ("arbre à chat", "Animaux", "Autre"),
    ("harnais vanille", "Animaux", "Autre"),
    ("garderie chats", "Animaux", "Autre"),
    ("stérilisation", "Animaux", "Vétérinaire"),
    ("vaccins vanille", "Animaux", "Vétérinaire"),

    # Vêtements
    ("asos", "Vêtements", "Vêtements"),
    ("commande asos", "Vêtements", "Vêtements"),
    ("commande zalando", "Vêtements", "Vêtements"),
    ("celio", "Vêtements", "Vêtements"),
    ("h&m", "Vêtements", "Vêtements"),
    ("uniqlo", "Vêtements", "Vêtements"),
    ("bershka", "Vêtements", "Vêtements"),
    ("jules ", "Vêtements", "Vêtements"),
    ("hollister", "Vêtements", "Vêtements"),
    ("new yorker", "Vêtements", "Vêtements"),
    ("pull ", "Vêtements", "Vêtements"),
    ("pantalon", "Vêtements", "Vêtements"),
    ("chemise", "Vêtements", "Vêtements"),
    ("sneaker", "Vêtements", "Chaussures"),
    ("chaussures", "Vêtements", "Chaussures"),
    ("lacets", "Vêtements", "Chaussures"),
    ("vinted", "Vêtements", "Vêtements"),
    ("fripes", "Vêtements", "Vêtements"),
    ("costume", "Vêtements", "Vêtements"),
    ("costard", "Vêtements", "Vêtements"),
    ("robe ", "Vêtements", "Vêtements"),
    ("showroom", "Vêtements", "Vêtements"),
    ("t-shirt", "Vêtements", "Vêtements"),
    ("tshirt", "Vêtements", "Vêtements"),
    ("vernis ", "Vêtements", "Vêtements"),
    ("bracelet montre", "Vêtements", "Vêtements"),
    ("bijoux", "Vêtements", "Vêtements"),
    ("bague ", "Vêtements", "Vêtements"),
    ("foulard", "Vêtements", "Vêtements"),
    ("sephora", "Courses autre", "Hygiène"),

    # Loisirs - Jeux vidéo
    ("player one", "Loisirs", "Jeux vidéo"),
    ("dofus", "Loisirs", "Jeux vidéo"),
    ("ogrines", "Loisirs", "Jeux vidéo"),
    ("brawl star", "Loisirs", "Jeux vidéo"),
    ("brawl stars", "Loisirs", "Jeux vidéo"),
    ("clash royale", "Loisirs", "Jeux vidéo"),
    ("tap titans", "Loisirs", "Jeux vidéo"),
    ("stacks colors", "Loisirs", "Jeux vidéo"),
    ("toon blast", "Loisirs", "Jeux vidéo"),
    ("minecraft", "Loisirs", "Jeux vidéo"),
    ("sea of thieves", "Loisirs", "Jeux vidéo"),
    ("animal crossing", "Loisirs", "Jeux vidéo"),
    ("among", "Loisirs", "Jeux vidéo"),
    ("mario ", "Loisirs", "Jeux vidéo"),
    ("mario party", "Loisirs", "Jeux vidéo"),
    ("pokemon", "Loisirs", "Jeux vidéo"),
    ("project zomboid", "Loisirs", "Jeux vidéo"),
    ("little nightmares", "Loisirs", "Jeux vidéo"),
    ("until dawn", "Loisirs", "Jeux vidéo"),
    ("man of medan", "Loisirs", "Jeux vidéo"),
    ("smash", "Loisirs", "Jeux vidéo"),
    ("valorant", "Loisirs", "Jeux vidéo"),
    ("rotmg", "Loisirs", "Jeux vidéo"),
    ("realm", "Loisirs", "Jeux vidéo"),
    ("tricky tower", "Loisirs", "Jeux vidéo"),
    ("we were here", "Loisirs", "Jeux vidéo"),
    ("we were here", "Loisirs", "Jeux vidéo"),
    ("instant gaming", "Loisirs", "Jeux vidéo"),
    ("jeux steam", "Loisirs", "Jeux vidéo"),
    ("jeu steam", "Loisirs", "Jeux vidéo"),
    ("nintendo", "Loisirs", "Jeux vidéo"),
    ("switch ", "Loisirs", "Jeux vidéo"),
    ("pogo", "Loisirs", "Jeux vidéo"),
    ("golf with", "Loisirs", "Jeux vidéo"),
    ("trackmania", "Loisirs", "Jeux vidéo"),
    ("knowledge is power", "Loisirs", "Jeux vidéo"),
    ("the room ", "Loisirs", "Jeux vidéo"),
    ("videoroulette", "Loisirs", "Jeux vidéo"),
    ("smallworld", "Loisirs", "Jeux vidéo"),
    ("skin lol", "Loisirs", "Jeux vidéo"),
    ("pack dofus", "Loisirs", "Jeux vidéo"),
    ("carte kdo steam", "Loisirs", "Jeux vidéo"),
    ("commande ankama", "Loisirs", "Jeux vidéo"),
    ("business tour", "Loisirs", "Jeux vidéo"),
    ("age of", "Loisirs", "Jeux vidéo"),
    ("pass de combat", "Loisirs", "Jeux vidéo"),
    ("unibet", "Loisirs", "Jeux vidéo"),
    ("google play", "Loisirs", "Jeux vidéo"),
    ("nexion", "Loisirs", "Jeux vidéo"),
    ("toomics", "Loisirs", "Jeux vidéo"),

    # Loisirs - Informatique
    ("raspberry pi", "Loisirs", "Informatique"),
    ("casque ", "Loisirs", "Informatique"),
    ("ecrans ", "Loisirs", "Informatique"),
    ("écrans ", "Loisirs", "Informatique"),
    ("displate", "Loisirs", "Informatique"),
    ("qwertee", "Vêtements", "Vêtements"),
    ("hub usb", "Loisirs", "Informatique"),
    ("ssd ", "Loisirs", "Informatique"),
    ("clavier", "Loisirs", "Informatique"),

    # Loisirs - Petit plaisir
    ("cultura", "Loisirs", "Petit plaisir"),
    ("fnac", "Loisirs", "Petit plaisir"),
    ("livre ", "Loisirs", "Petit plaisir"),
    ("livres ", "Loisirs", "Petit plaisir"),
    ("picsou", "Loisirs", "Petit plaisir"),
    ("darwin", "Loisirs", "Petit plaisir"),
    ("displays pokemon", "Loisirs", "Petit plaisir"),
    ("jeux de carte", "Loisirs", "Petit plaisir"),
    ("jeux de société", "Loisirs", "Petit plaisir"),
    ("photos ", "Loisirs", "Petit plaisir"),
    ("cheerz", "Loisirs", "Petit plaisir"),

    # Courses autre (non-food shopping)
    ("sanoflore", "Courses autre", "Hygiène"),
    ("démaquillant", "Courses autre", "Hygiène"),
    ("gel douche", "Courses autre", "Hygiène"),
    ("parfum", "Courses autre", "Hygiène"),
    ("mascara", "Courses autre", "Hygiène"),
    ("protège écran", "Courses autre", "Hygiène"),
    ("savon", "Courses autre", "Hygiène"),

    # Foyer - Meuble/Objets/Décoration
    ("ikea", "Foyer", "Meuble"),
    ("cdiscount", "Foyer", "Meuble"),
    ("maisons du monde", "Foyer", "Décoration"),
    ("sostrene", "Foyer", "Décoration"),
    ("armoire", "Foyer", "Meuble"),
    ("matelas", "Foyer", "Meuble"),
    ("machine à laver", "Foyer", "Meuble"),
    ("machine maman", "Foyer", "Meuble"),
    ("four micro", "Foyer", "Meuble"),
    ("frigo", "Foyer", "Meuble"),
    ("congélateur", "Foyer", "Meuble"),
    ("télévision", "Foyer", "Meuble"),
    ("télé le retour", "Foyer", "Meuble"),
    ("table basse", "Foyer", "Meuble"),
    ("sapin de noël", "Foyer", "Décoration"),
    ("rideaux", "Foyer", "Objets"),
    ("tringles", "Foyer", "Objets"),
    ("ampoules", "Foyer", "Objets"),
    ("moustiquaire", "Foyer", "Objets"),
    ("ventilateur", "Foyer", "Objets"),
    ("poubelle", "Foyer", "Objets"),
    ("led", "Foyer", "Objets"),
    ("peinture", "Foyer", "Objets"),
    ("cartons brico", "Foyer", "Objets"),
    ("caisse à outils", "Foyer", "Objets"),
    ("casto", "Foyer", "Objets"),
    ("brico dépôt", "Foyer", "Objets"),
    ("double des clés", "Foyer", "Objets"),
    ("double clé", "Foyer", "Objets"),
    ("premier loyer", "Foyer", "Loyer"),
    ("frais d'agence", "Foyer", "Loyer"),

    # Voyages
    ("staycation", "Voyages", "Hebergement"),
    ("airbnb", "Voyages", "Hebergement"),
    ("hôtel", "Voyages", "Hebergement"),
    ("hostel", "Voyages", "Hebergement"),
    ("logement amsterdam", "Voyages", "Hebergement"),
    ("taxe de séjour", "Voyages", "Hebergement"),
    ("taxe tourisme", "Voyages", "Hebergement"),
    ("taxe staycation", "Voyages", "Hebergement"),
    ("taxe l'hôtel", "Voyages", "Hebergement"),
    ("avion ", "Voyages", "Transports"),
    ("vol nyc", "Voyages", "Transports"),
    ("esta ", "Voyages", "Transports"),
    ("navette", "Voyages", "Transports"),
    ("voyage amsterdam", "Voyages", "Transports"),
    ("voyage selma", "Voyages", "Transports"),
    ("vacances ", "Voyages", "Hebergement"),
    ("milan", "Voyages", "Autre"),
    ("amsterdam", "Voyages", "Autre"),
    ("londres", "Voyages", "Autre"),
    ("barcelona", "Voyages", "Autre"),
    ("barcelone", "Voyages", "Autre"),
    ("bruges", "Voyages", "Autre"),
    ("royan", "Voyages", "Autre"),
    ("majorque", "Voyages", "Autre"),
    ("zoo central park", "Voyages", "Activité"),
    ("konar a time", "Voyages", "Autre"),

    # Foyer - various
    ("selma ", "Autre", "Autre"),
    ("tata ", "Aide", None),
    ("nouveau téléphone", "Loisirs", "Informatique"),
    ("coque ", "Loisirs", "Informatique"),
    ("rhinoshield", "Loisirs", "Informatique"),
    ("ordinateur", "Loisirs", "Informatique"),
    ("drone", "Loisirs", "Informatique"),
    ("batterie ", "Loisirs", "Informatique"),
    ("câble", "Loisirs", "Informatique"),
    ("câbles", "Loisirs", "Informatique"),
    ("chargeur", "Loisirs", "Informatique"),
    ("adaptateur", "Loisirs", "Informatique"),
    ("caméra", "Loisirs", "Informatique"),
    ("souris ", "Loisirs", "Informatique"),
    ("bungee", "Loisirs", "Informatique"),
    ("arduino", "Loisirs", "Informatique"),
    ("ukulele", "Loisirs", "Petit plaisir"),
    ("capodastre", "Loisirs", "Petit plaisir"),
    ("partitions", "Loisirs", "Petit plaisir"),
    ("lampe ", "Foyer", "Objets"),

    # Education
    ("cvec", "Autre", "Autre"),
    ("frais de scolarité", "Autre", "Autre"),
    ("frais de réinscription", "Autre", "Autre"),
    ("bde ", "Autre", "Autre"),
    ("toeic", "Autre", "Autre"),
    ("passeport", "Autre", "Autre"),
    ("photo ", "Autre", "Autre"),
    ("photos d'identité", "Autre", "Autre"),

    # Retrait / cash
    ("retrait ", "Autre", "Autre"),
    ("retrait", "Autre", "Autre"),
    ("espèces", "Autre", "Autre"),
    ("solde ", "Autre", "Autre"),
    ("commande carte", "Autre", "Autre"),
]

# Contains rules (searched in label, case-insensitive) - fallbacks
CONTAINS_RULES = [
    # Alimentation patterns
    ("courses", "Alimentation", "Courses"),
    ("bouffe", "Alimentation", "Resto"),
    ("pizza", "Alimentation", "Resto"),
    ("mcdo", "Alimentation", "Resto"),
    ("burger", "Alimentation", "Resto"),
    ("uber eats", "Alimentation", "Resto"),
    ("deliveroo", "Alimentation", "Resto"),
    ("domac", "Alimentation", "Resto"),
    ("captain", "Alimentation", "Resto"),
    ("sushi", "Alimentation", "Resto"),
    ("jap ", "Alimentation", "Resto"),
    ("ramen", "Alimentation", "Resto"),
    ("kebab", "Alimentation", "Resto"),
    ("nuggets", "Alimentation", "Resto"),
    ("tacos", "Alimentation", "Resto"),
    ("glace", "Alimentation", "Resto"),
    ("madeleines", "Alimentation", "Resto"),
    ("kinder", "Alimentation", "Resto"),
    ("boulangerie", "Alimentation", "Resto"),
    ("croissant", "Alimentation", "Resto"),
    ("crêpe", "Alimentation", "Resto"),
    ("makis", "Alimentation", "Resto"),
    ("carbo", "Alimentation", "Courses"),
    ("fondue", "Alimentation", "Courses"),
    ("pré ", "Alimentation", "Courses"),

    # Sorties
    ("collègues", "Alimentation", "Resto"),
    ("école", "Alimentation", "Resto"),
    ("ecole", "Alimentation", "Resto"),
    ("esgi", "Alimentation", "Resto"),
    ("boulot", "Alimentation", "Resto"),
    ("soirée", "Sorties", "Soirée"),
    ("soiree", "Sorties", "Soirée"),
    ("bowling", "Sorties", "Autre"),
    ("ciné", "Sorties", "Autre"),
    ("concert", "Sorties", "Concert"),
    ("bar ", "Sorties", "Bar"),
    ("pinte", "Sorties", "Bar"),
    ("bières", "Sorties", "Bar"),

    # Transport
    ("train", "Sorties", "Transport"),
    ("essence", "Sorties", "Transport"),
    ("péage", "Sorties", "Transport"),
    ("parking", "Sorties", "Transport"),
    ("gpl", "Sorties", "Transport"),
    ("uber", "Sorties", "Transport"),
    ("taxi", "Sorties", "Transport"),
    ("métro", "Sorties", "Transport"),

    # Achats
    ("amazon", "Autre", "Autre"),
    ("aliexpress", "Autre", "Autre"),
    ("paypal", "Autre", "Autre"),
    ("lydia", "Autre", "Autre"),
    ("pumpkin", "Autre", "Autre"),
    ("selma", "Autre", "Autre"),
    ("camille", "Autre", "Autre"),
    ("didine", "Autre", "Autre"),

    # Remboursements
    ("remboursement", "Rentrée", "Autre"),
    ("rembours", "Rentrée", "Autre"),

    # Crypto
    ("binance", "Crypto", None),
    ("crypto", "Crypto", None),

    # Animaux
    ("chat", "Animaux", "Autre"),
    ("vanille", "Animaux", "Autre"),
    ("véto", "Animaux", "Vétérinaire"),

    # Santé
    ("médecin", "Santé", "Médecin"),
    ("pharmacie", "Santé", "Médicaments"),
    ("mutuelle", "Santé", "Médecin"),

    # Voyages (city names in labels)
    ("amsterdam", "Voyages", "Autre"),
    ("milan", "Voyages", "Autre"),
    ("nice", "Voyages", "Autre"),
    ("barcelone", "Voyages", "Autre"),
    ("espagne", "Voyages", "Autre"),
    ("majorque", "Voyages", "Autre"),
    ("bruges", "Voyages", "Autre"),
    ("londres", "Voyages", "Autre"),
    ("lille", "Voyages", "Autre"),
    ("nyc", "Voyages", "Autre"),
    ("lloret", "Voyages", "Autre"),
    ("royan", "Voyages", "Autre"),
    ("cabourg", "Voyages", "Autre"),
    ("salers", "Voyages", "Autre"),
    ("camping", "Voyages", "Autre"),
    ("montagne", "Voyages", "Autre"),
    ("australie", "Voyages", "Autre"),

    # Cadeau
    ("kdo", "Cadeau", "Autre"),
    ("cadeau", "Cadeau", "Autre"),
    ("anniv", "Cadeau", "Anniversaire"),
    ("noël", "Cadeau", "Autre"),
    ("noel", "Cadeau", "Autre"),
]


def categorize_label(label: str, amount: float) -> tuple:
    """Return (category, subcategory) for a given label."""
    # 1. Try exact match
    if label in EXACT_RULES:
        return EXACT_RULES[label]

    lower = label.lower()

    # 2. Try prefix rules
    for prefix, cat, subcat in PREFIX_RULES:
        if lower.startswith(prefix):
            return (cat, subcat)

    # 3. Try contains rules
    for pattern, cat, subcat in CONTAINS_RULES:
        if pattern in lower:
            return (cat, subcat)

    # 4. Amount-based heuristics for remaining
    if amount > 0:
        # Positive amounts are usually income
        return ("Rentrée", "Autre")

    # Default
    return ("Non catégorisé", None)


def main():
    tx_path = os.path.join(DATA_DIR, "transactions-bnp.json")
    cat_path = os.path.join(DATA_DIR, "categories.json")

    with open(tx_path, "r", encoding="utf-8") as f:
        transactions = json.load(f)

    with open(cat_path, "r", encoding="utf-8") as f:
        categories = json.load(f)

    # Get valid category names
    valid_cats = {c["name"] for c in categories}
    valid_subs = {}
    for c in categories:
        for s in c["subcategories"]:
            valid_subs.setdefault(c["name"], set()).add(s)

    categorized_count = 0
    uncategorized_labels = set()
    new_cats_needed = set()
    new_subs_needed = set()

    for tx in transactions:
        # Skip transactions that already have a non-default category
        if "category" in tx and tx["category"] != "Non catégorisé":
            continue

        label = tx["label"]
        amount = tx["amount"]
        cat, subcat = categorize_label(label, amount)

        tx["category"] = cat
        if subcat:
            tx["subcategory"] = subcat
        elif "subcategory" in tx:
            del tx["subcategory"]
        categorized_count += 1

        # Track new categories/subcategories
        if cat not in valid_cats:
            new_cats_needed.add(cat)
        if subcat and cat in valid_subs and subcat not in valid_subs.get(cat, set()):
            new_subs_needed.add((cat, subcat))

    # Write updated transactions
    with open(tx_path, "w", encoding="utf-8") as f:
        json.dump(transactions, f, ensure_ascii=False, indent=2)

    # Update categories.json with any new subcategories
    if new_subs_needed:
        for c in categories:
            for cat_name, sub_name in new_subs_needed:
                if c["name"] == cat_name and sub_name not in c["subcategories"]:
                    c["subcategories"].append(sub_name)
                    c["subcategories"].sort()
        with open(cat_path, "w", encoding="utf-8") as f:
            json.dump(categories, f, ensure_ascii=False, indent=2)

    # Auto-assign subcategory for Economies without one
    eco_fixed = 0
    for tx in transactions:
        if tx.get("category") == "Economies" and not tx.get("subcategory"):
            amount = tx["amount"]
            if amount < 0:
                tx["subcategory"] = "Ajout"
                eco_fixed += 1
            elif amount > 0:
                tx["subcategory"] = "Retrait"
                eco_fixed += 1

    # Write updated transactions (includes Economies subcategory fixes)
    if eco_fixed:
        with open(tx_path, "w", encoding="utf-8") as f:
            json.dump(transactions, f, ensure_ascii=False, indent=2)

    # Stats
    print(f"Categorized {categorized_count} transactions")
    if eco_fixed:
        print(f"Fixed {eco_fixed} Economies transactions missing subcategory")

    # Check distribution
    from collections import Counter
    cat_counts = Counter()
    still_uncat = 0
    for tx in transactions:
        cat = tx.get("category", "???")
        sub = tx.get("subcategory", "")
        cat_counts[(cat, sub)] += 1
        if cat == "Non catégorisé":
            still_uncat += 1

    print(f"\nStill uncategorized: {still_uncat}")
    print(f"\nCategory distribution:")
    for (cat, sub), count in sorted(cat_counts.items()):
        label = f"{cat} / {sub}" if sub else cat
        print(f"  {count:5d}  {label}")

    # Show uncategorized labels
    if still_uncat > 0:
        uncat_labels = Counter()
        for tx in transactions:
            if tx.get("category") == "Non catégorisé":
                uncat_labels[tx["label"]] += 1
        print(f"\nUncategorized labels ({len(uncat_labels)} unique):")
        for label, count in sorted(uncat_labels.items(), key=lambda x: -x[1]):
            print(f"  {count:3d}x  {label}")


if __name__ == "__main__":
    main()
