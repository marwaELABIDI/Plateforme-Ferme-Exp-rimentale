const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// =========================================================================================
// DATA EXTRACTED FROM F.75 DOCUMENT
// =========================================================================================

// Entities (Departments/Organizations) from the 'Département' column and other sections
const entities = [
  { name: 'AITTC', notes: 'Africa IT & Innovation Center - UM6P' },
  { name: 'AGBS', notes: 'AgroBioSciences - UM6P' },
  { name: 'BPS-AGBS', notes: 'A sub-entity of AgroBioSciences' },
  { name: 'Africane genome center(AGC)', notes: 'African Genome Center - UM6P' },
  { name: 'ESAFE', notes: 'School of Agriculture, Fertilization and Environmental Sciences - UM6P' },
  { name: 'Agri Edge', notes: 'UM6P Program' },
  { name: 'Smart Pharm', notes: 'UM6P Program' },
  { name: 'EMINES', notes: 'School of Industrial Management - UM6P' },
  { name: 'UM6P', notes: 'Université Mohammed VI Polytechnique' },
  { name: 'OCP JORF LASFAR', notes: 'OCP Group - Jorf Lasfar Site' },
];

// All personnel mentioned in the document, with assigned roles and generated emails.
// Farm staff are 'SUPERVISOR', project responsibles are 'CLIENT'.
const users = [
  
  // Comité de pilotage & Farm Staff (Supervisors)
  { name: 'Younes JNAOUI', email: 'younes.jnaoui@aittc.ma', role: 'SUPERVISOR', entityName: 'AITTC' },
  { name: 'Yasmine TAOUIR', email: 'yasmine.taouir@aittc.ma', role: 'SUPERVISOR', entityName: 'AITTC' },
  { name: 'Lahoucine AIT YAHIA', email: 'lahoucine.aityahia@aittc.ma', role: 'SUPERVISOR', entityName: 'AITTC' },
  { name: 'Jelloul FNIZI', email: 'jelloul.fnizi@aittc.ma', role: 'SUPERVISOR', entityName: 'AITTC' },
  { name: 'Yassine ELBEQQAL', email: 'yassine.elbeqqal@aittc.ma', role: 'SUPERVISOR', entityName: 'AITTC' },
  { name: 'Aziz JMEL', email: 'aziz.jmel@aittc.ma', role: 'SUPERVISOR', entityName: 'AITTC' },
  { name: 'Brahim EL KAJAF', email: 'brahim.elkajaf@aittc.ma', role: 'SUPERVISOR', entityName: 'AITTC' },
  { name: 'Bouchaib ESSAIH', email: 'bouchaib.essaih@aittc.ma', role: 'SUPERVISOR', entityName: 'AITTC' },

  // Project Responsibles (Clients)
  { name: 'Fatima Ezzahra JABBOUR', email: 'fatima.jabbour@aittc.ma', role: 'CLIENT', entityName: 'AITTC' },
  { name: 'Adnan BENAICH', email: 'adnan.benaich@aittc.ma', role: 'CLIENT', entityName: 'AITTC' },
  { name: 'Adil EL BAOUCHI', email: 'adil.elbaouchi@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Hassan ANNAZ', email: 'hassan.annaz@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Manal MHADA', email: 'manal.mhada@agbs.ma', role: 'CLIENT', entityName: 'BPS-AGBS' },
  { name: 'Khadija AIT ELALLAM', email: 'khadija.aitelallam@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Bouchra BENMRID', email: 'bouchra.benmrid@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Khadija NASRAOUI', email: 'khadija.nasraoui@aittc.ma', role: 'CLIENT', entityName: 'AITTC' },
  { name: 'Hamid MOUTAOUAKIL', email: 'hamid.moutaouakil@aittc.ma', role: 'CLIENT', entityName: 'AITTC' },
  { name: 'Massamba DIOP', email: 'massamba.diop@aittc.ma', role: 'CLIENT', entityName: 'AITTC' },
  { name: 'Aziza TANGI', email: 'aziza.tangi@aittc.ma', role: 'CLIENT', entityName: 'AITTC' },
  { name: 'Rachid GHANI', email: 'rachid.ghani@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Dr EL HAFIDI', email: 'dr.elhafidi@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Rachida Naciri', email: 'rachida.naciri@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Mustapha El Janati', email: 'mustapha.eljanati@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Chtouki Mohamed', email: 'chtouki.mohamed@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Safi Uwase', email: 'safi.uwase@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Mohamed El mahdi EL BOUKHARI', email: 'm.elboukhari@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Bouhia Younes', email: 'bouhia.younes@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Nawal TAAIME', email: 'nawal.taaime@aittc.ma', role: 'CLIENT', entityName: 'AITTC' },
  { name: 'Mohamed Louay MAATOUGUI', email: 'mohamed.maatougui@aittc.ma', role: 'CLIENT', entityName: 'AITTC' },
  { name: 'Younes BOUHIYA', email: 'younes.bouhiya@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Imad KHATOUR', email: 'imad.khatour@agc.ma', role: 'CLIENT', entityName: 'Africane genome center(AGC)' },
  { name: 'Khadija EI HAZZAM', email: 'khadija.elhazzam@agbs.ma', role: 'CLIENT', entityName: 'BPS-AGBS' },
  { inconnu_client_1: true, name: 'Haitam MOULAY', email: 'haitam.moulay@aittc.ma', role: 'CLIENT', entityName: 'AITTC' },
  { inconnu_client_2: true, name: 'Dontien', email: 'dontien.client@aittc.ma', role: 'CLIENT', entityName: 'AITTC' },
  { name: 'Mbarka OUTBAKAT', email: 'mbarka.outbakat@aittc.ma', role: 'CLIENT', entityName: 'AITTC' },
  { name: 'Saida TAYIBI', email: 'saida.tayibi@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Chaimaa HAKIM', email: 'chaimaa.hakim@agbs.ma', role: 'CLIENT', entityName: 'AGBS' },
  { name: 'Dr CHOKRALLAH', email: 'dr.chokrallah@aittc.ma', role: 'CLIENT', entityName: 'AITTC' },
  { name: 'Mohamed BOULIF', email: 'mohamed.boulif@esafe.ma', role: 'CLIENT', entityName: 'ESAFE' },
];

// Physical locations (Fields) from the 'Emplacement' column
const fields = [
  { name: 'La pépinière', location: 'Ben Guérir', totalSurfaceM2: 0, freeSurfaceM2: 0 },
  { name: 'Sidi El Aydi', location: 'Station expérimentale Sidi El Aydi', totalSurfaceM2: 0, freeSurfaceM2: 0 },
  { name: 'Tassaout', location: 'Station expérimentale Tassaout', totalSurfaceM2: 0, freeSurfaceM2: 0 },
  { name: 'La mine', location: 'Zone minière Ben Guérir', totalSurfaceM2: 0, freeSurfaceM2: 0 },
  { name: 'A la ferme', location: 'Ferme Ben Guérir (Parcelles générales)', totalSurfaceM2: 0, freeSurfaceM2: 0 },
  { name: 'Site externe', location: 'Site externe (ex: OCP Jorf Lasfar)', totalSurfaceM2: 0, freeSurfaceM2: 0 },
];

// Categories of work derived from the 'Type d'activité' and project titles.
const activityTypes = [
  { label: 'Recherche Scientifique', description: 'Essais et projets de recherche' },
  { label: 'Production Animale', description: 'Activités liées à l\'élevage' },
  { label: 'Multiplication Végétale', description: 'Multiplication de plantes et semences' },
  { label: 'Arboriculture', description: 'Culture d\'arbres fruitiers et forestiers' },
  { label: 'Maraichage', description: 'Culture de légumes' },
  { label: 'Céréaliculture', description: 'Culture de céréales' },
  { label: 'Cultures Fourragères', description: 'Culture de plantes destinées à l\'alimentation animale' },
  { label: 'Production de PAM', description: 'Production de Plantes Aromatiques et Médicinales' },
  { label: 'Ornementale et Espaces Verts', description: 'Gestion des espaces verts et plantes ornementales' },
  { label: 'Agriculture de Précision', description: 'Projets utilisant des technologies de pointe (Smart Farming)' },
  { label: 'Développement et Formation', description: 'Projets de développement, formation et apprentissage (Learning by Farming)' },
  { label: 'Commercialisation', description: 'Activités de commercialisation des produits de la ferme' },
  { label: 'Gestion des Déchets', description: 'Projets liés au traitement et à la valorisation des déchets' },
  { label: 'Réhabilitation des Sols', description: 'Projets visant à restaurer la qualité des sols' },
  { label: 'Collection et Conservation', description: 'Maintien de collections de ressources génétiques (cactus, acacia, etc.)' },
];

// Comprehensive list of all projects and programs from both tables in the F.75 document.
const projects = [
  // --- Table 1: Recherche scientifique ---
  { title: "OCP Innovation", fieldName: "La pépinière", clientName: "Fatima Ezzahra JABBOUR", supervisorName: "Yasmine TAOUIR", surfaceM2: 30, dateStr: "09-2021 au 04-2022", status: "FINALISE", activityTypeLabel: "Recherche Scientifique" }, // Date corrected from 04-2021
  { title: "OCP Strategy (ferme)", fieldName: "La pépinière", clientName: "Adnan BENAICH", supervisorName: "Yasmine TAOUIR", surfaceM2: 30, dateStr: "02-2021 au 12-2021", status: "FINALISE", activityTypeLabel: "Recherche Scientifique" },
  { title: "OCP Strategy (Station expérimentale Sidi El Aydi)", fieldName: "Sidi El Aydi", clientName: "Adnan BENAICH", supervisorName: "Yasmine TAOUIR", surfaceM2: 3650, dateStr: "02-2021 au 12-2021", status: "FINALISE", activityTypeLabel: "Recherche Scientifique" },
  { title: "OCP Strategy (Station expérimentale Tassaout)", fieldName: "Tassaout", clientName: "Adnan BENAICH", supervisorName: "Yasmine TAOUIR", surfaceM2: 3611, dateStr: "02-2021 au 12-2021", status: "FINALISE", activityTypeLabel: "Recherche Scientifique" },
  { title: "Multiplication des semences Vigna et Lentille", fieldName: "La pépinière", clientName: "Adil EL BAOUCHI", supervisorName: "Yasmine TAOUIR", surfaceM2: 30, dateStr: "05-2021 au 08-2021", status: "FINALISE", activityTypeLabel: "Multiplication Végétale" },
  { title: "Valorisation agronomique de la boue", fieldName: "La pépinière", clientName: "Fatima Ezzahra JABBOUR", supervisorName: "Yasmine TAOUIR", surfaceM2: 60, dateStr: "11-2021 au 02-2022", status: "FINALISE", activityTypeLabel: "Recherche Scientifique" },
  { title: "Le potentiel biostimulant des extraits des plantes-1", fieldName: "La pépinière", clientName: "Hassan ANNAZ", supervisorName: "Yasmine TAOUIR", surfaceM2: 20, dateStr: "11-2021 au 01-2022", status: "FINALISE", activityTypeLabel: "Recherche Scientifique" },
  { title: "Collection Cactus AgBS", fieldName: "La pépinière", clientName: "Manal MHADA", supervisorName: "Yasmine TAOUIR", surfaceM2: 100, dateStr: "Depuis 08-2021", status: "EN_COURS", activityTypeLabel: "Collection et Conservation" },
  { title: "Réhabilitation des sols minier par les PAM", fieldName: "La pépinière", clientName: "Khadija AIT ELALLAM", supervisorName: "Yasmine TAOUIR", surfaceM2: 3, dateStr: "11-2021 au 03-2022", status: "EN_COURS", activityTypeLabel: "Réhabilitation des Sols" },
  { title: "Test d'inoculation de la fève sous stress", fieldName: "La pépinière", clientName: "Bouchra BENMRID", supervisorName: "Yasmine TAOUIR", surfaceM2: 44, dateStr: "11-2021 au 04-2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Le potentiel biostimulant des extraits des plantes-2", fieldName: "La pépinière", clientName: "Hassan ANNAZ", supervisorName: "Yasmine TAOUIR", surfaceM2: 20, dateStr: "04-04-22 au 15-06-22", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Collecte et tri des déchets ménagers", fieldName: "La pépinière", clientName: "Khadija NASRAOUI", supervisorName: "Yasmine TAOUIR", surfaceM2: 0, dateStr: "Depuis 2021", status: "EN_COURS", activityTypeLabel: "Gestion des Déchets" },
  { title: "Agroforesterie", fieldName: "La pépinière", clientName: "Massamba DIOP", supervisorName: "Yasmine TAOUIR", surfaceM2: 29160, dateStr: "12-2020 au 12-2024", status: "EN_COURS", activityTypeLabel: "Arboriculture" },
  { title: "Collection cactus AITTC", fieldName: "La pépinière", clientName: "Aziza TANGI", supervisorName: "Yasmine TAOUIR", surfaceM2: 130, dateStr: "Depuis 11-2018", status: "EN_COURS", activityTypeLabel: "Collection et Conservation" },
  { title: "Dévelopement de formulation de fertilisant(AS17)", fieldName: "La pépinière", clientName: "Rachid GHANI", supervisorName: "Yasmine TAOUIR", surfaceM2: 50, dateStr: "13-12-2021 au 13-05-2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Essai de triticale", fieldName: "La pépinière", clientName: "Dr EL HAFIDI", supervisorName: "Yasmine TAOUIR", surfaceM2: 300, dateStr: "depuis 20-12-2021", status: "EN_COURS", activityTypeLabel: "Céréaliculture" },
  { title: "Essai ComSilageCorn", fieldName: "La pépinière", clientName: "Rachida Naciri", supervisorName: "Yasmine TAOUIR", surfaceM2: 25, dateStr: "25-03-22 au 23-06-2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Effets d'engrais phosphatés sur les cultures légumineuses (Soil PhorLife)", fieldName: "La pépinière", clientName: "Chtouki Mohamed", supervisorName: "Yasmine TAOUIR", surfaceM2: 20, dateStr: "04-22 au 06-22", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Effets d'engrais phosphatés enrichis en micronutriments sur maïs (ESAFE)", fieldName: "La pépinière", clientName: "Safi Uwase", supervisorName: "Yasmine TAOUIR", surfaceM2: 50, dateStr: "28-03-22 au 30-6-22", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Fertialgues 1 (Essai préliminaire)", fieldName: "La pépinière", clientName: "Mohamed El mahdi EL BOUKHARI", supervisorName: "Yassine ELBEQQAL", surfaceM2: 2, dateStr: "09-2021 au 10-2021", status: "FINALISE", activityTypeLabel: "Recherche Scientifique" },
  { title: "Fertialgues 2 (Effet sur stress hydrique tomate)", fieldName: "La pépinière", clientName: "Mohamed El mahdi EL BOUKHARI", supervisorName: "Yassine ELBEQQAL", surfaceM2: 30, dateStr: "10-2021 au 11-2022", status: "FINALISE", activityTypeLabel: "Recherche Scientifique" },
  { title: "Croissance des tomates sous stress", fieldName: "La pépinière", clientName: "Mohamed El mahdi EL BOUKHARI", supervisorName: "Yassine ELBEQQAL", surfaceM2: 35, dateStr: "10-2021 au 12-2021", status: "FINALISE", activityTypeLabel: "Recherche Scientifique" },
  { title: "Fertialgues3 (Effet extraits algues et acides humiques)", fieldName: "La pépinière", clientName: "Bouhia Younes", supervisorName: "Yassine ELBEQQAL", surfaceM2: 30, dateStr: "28-12-2021 au 28-02-2022", status: "FINALISE", activityTypeLabel: "Recherche Scientifique" },
  { title: "Evaluer les dates de semis du quinoa", fieldName: "La pépinière", clientName: "Nawal TAAIME", supervisorName: "Yassine ELBEQQAL", surfaceM2: 1699, dateStr: "11-2021 au 09-2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Evaluer l'effet de la fertilisation NPK", fieldName: "La pépinière", clientName: "Nawal TAAIME", supervisorName: "Yassine ELBEQQAL", surfaceM2: 5809, dateStr: "12-2021 au 09-2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Effet résiduel de l'amendement organique sur quinoa", fieldName: "La pépinière", clientName: "Nawal TAAIME", supervisorName: "Yassine ELBEQQAL", surfaceM2: 3584, dateStr: "12-2021 au 09-2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Evaluation de la collection du quinoa", fieldName: "La pépinière", clientName: "Manal MHADA", supervisorName: "Yassine ELBEQQAL", surfaceM2: 2268, dateStr: "10-2021 au 07-2022", status: "EN_COURS", activityTypeLabel: "Collection et Conservation" },
  { title: "Carbon Farming (ferme)", fieldName: "La pépinière", clientName: "Mohamed Louay MAATOUGUI", supervisorName: "Yassine ELBEQQAL", surfaceM2: 20000, dateStr: "10-2018 au 04-2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Effet d'applications de produits organiques", fieldName: "La pépinière", clientName: "Younes BOUHIYA", supervisorName: "Yassine ELBEQQAL", surfaceM2: 10, dateStr: "11-2021 au 03-2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Plateforme collection acacia", fieldName: "La pépinière", clientName: "Mohamed Louay MAATOUGUI", supervisorName: "Yassine ELBEQQAL", surfaceM2: 4607.5, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Collection et Conservation" },
  { title: "Essai de comparaison de fertilisants azotés", fieldName: "La pépinière", clientName: "Manal MHADA", supervisorName: "Yassine ELBEQQAL", surfaceM2: 14, dateStr: "11-2021 au 04-2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Test efficacité du produit Biostimulant (Projet Mycorhize)", fieldName: "La pépinière", clientName: "Imad KHATOUR", supervisorName: "Yassine ELBEQQAL", surfaceM2: 0, dateStr: "En cours au laboratoire de l'UM6P", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Essai de comparaison de compostes", fieldName: "La mine", clientName: "Haitam MOULAY", supervisorName: "Yassine ELBEQQAL", surfaceM2: 14, dateStr: "15/02/2022 au 06/2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Réhabilitation", fieldName: "La mine", clientName: "Dontien", supervisorName: "Jelloul FNIZI", surfaceM2: 8500, dateStr: "02-2020 au 02-2024", status: "EN_COURS", activityTypeLabel: "Réhabilitation des Sols" },
  { title: "Evaluation du phosphogypse en tant que fertilisant", fieldName: "La pépinière", clientName: "Mbarka OUTBAKAT", supervisorName: "Yasmine TAOUIR", surfaceM2: 3500, dateStr: "09-2020 au 12-2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Evaluation de l'effet de la dose de phosphogypse", fieldName: "La pépinière", clientName: "Mbarka OUTBAKAT", supervisorName: "Yasmine TAOUIR", surfaceM2: 150, dateStr: "09-2020 au 12-2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Effet de la qualité du phosphogypse", fieldName: "La pépinière", clientName: "Mbarka OUTBAKAT", supervisorName: "Yasmine TAOUIR", surfaceM2: 150, dateStr: "09-2020 au 12-2023", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Test de croissance des plantes-test amendement organique", fieldName: "La pépinière", clientName: "Saida TAYIBI", supervisorName: "Yasmine TAOUIR", surfaceM2: 50, dateStr: "08/02/2022 au 08/06/2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Installation d'une plateforme des cultures biosalines", fieldName: "La pépinière", clientName: "Dr CHOKRALLAH", supervisorName: "Lahoucine AIT YAHIA", surfaceM2: 20, dateStr: "Depuis 05-2021", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Oliveraie Agro-écologique", fieldName: "A la ferme", clientName: "Mohamed BOULIF", supervisorName: "Jelloul FNIZI", surfaceM2: 14600, dateStr: "06/01/2021 à l'infeni", status: "EN_COURS", activityTypeLabel: "Arboriculture" },
  { title: "Carbon Farming (mine)", fieldName: "La mine", clientName: "Mohamed Louay MAATOUGUI", supervisorName: "Jelloul FNIZI", surfaceM2: 20000, dateStr: "10-2018 au 04-2022", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Projet introduction de la culture du goji", fieldName: "La pépinière", clientName: "Khadija NASRAOUI", supervisorName: "Jelloul FNIZI", surfaceM2: 5000, dateStr: "mois 10-2021", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },
  { title: "Résistance des bacs", fieldName: "La pépinière", clientName: "Adil EL BAOUCHI", supervisorName: "Jelloul FNIZI", surfaceM2: 2, dateStr: "02-2021 au 03-2021", status: "EN_COURS", activityTypeLabel: "Recherche Scientifique" },

  // --- Table 2: Production Agricole et Développement ---
  { title: "Production de poulet fermier", fieldName: "A la ferme", clientName: "AITTC", supervisorName: "Yasmine TAOUIR", surfaceM2: 0, dateStr: "Programme ferme", status: "PROGRAMME", activityTypeLabel: "Production Animale" },
  { title: "Multiplication des plantes (arboricoles, ornementales, PAM)", fieldName: "La pépinière", clientName: "AITTC", supervisorName: "Lahoucine AIT YAHIA", surfaceM2: 4000, dateStr: "Programme ferme", status: "PROGRAMME", activityTypeLabel: "Multiplication Végétale" },
  { title: "Production des semences ancestrales du cumin", fieldName: "A la pépinière", clientName: "AITTC", supervisorName: "Yasmine TAOUIR", surfaceM2: 26700, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Multiplication Végétale" },
  { title: "Production des semences des céréales INRA", fieldName: "A la pépinière", clientName: "AITTC", supervisorName: "Yasmine TAOUIR", surfaceM2: 1000, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Multiplication Végétale" },
  { title: "Production des semences quinoa", fieldName: "A la pépinière", clientName: "AITTC", supervisorName: "Yasmine TAOUIR", surfaceM2: 1152, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Multiplication Végétale" },
  { title: "Plateforme arganier", fieldName: "A la pépinière", clientName: "AITTC", supervisorName: "Jelloul FNIZI", surfaceM2: 2600, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Arboriculture" },
  { title: "Plateforme cactus", fieldName: "A la pépinière", clientName: "AITTC", supervisorName: "Yasmine TAOUIR", surfaceM2: 10000, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Collection et Conservation" },
  { title: "Verger Olivier (jeune et âgé)", fieldName: "A la ferme", clientName: "AITTC", supervisorName: "Jelloul FNIZI", surfaceM2: 11000, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Arboriculture" },
  { title: "Projet panier (Tomate, carotte, courgette...)", fieldName: "A la pépinière", clientName: "AITTC", supervisorName: "Jelloul FNIZI", surfaceM2: 1000, dateStr: "A lancer", status: "A_LANCER", activityTypeLabel: "Maraichage" },
  { title: "Semis d'orge", fieldName: "A la ferme", clientName: "AITTC", supervisorName: "Jelloul FNIZI", surfaceM2: 150000, dateStr: "A lancer", status: "A_LANCER", activityTypeLabel: "Céréaliculture" },
  { title: "Production atriplex", fieldName: "A la pépinière", clientName: "AITTC", supervisorName: "Lahoucine AIT YAHIA", surfaceM2: 100, dateStr: "programme", status: "PROGRAMME", activityTypeLabel: "Cultures Fourragères" },
  { title: "Production panicum", fieldName: "A la pépinière", clientName: "Lahoucine AIT YAHIA", supervisorName: "Lahoucine AIT YAHIA", surfaceM2: 50, dateStr: "programme", status: "PROGRAMME", activityTypeLabel: "Cultures Fourragères" },
  { title: "Production safran, menthe, verveine", fieldName: "A la pépinière", clientName: "AITTC", supervisorName: "Yasmine TAOUIR", surfaceM2: 794, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Production de PAM" },
  { title: "Installation clôture végétales de la ferme", fieldName: "A la ferme", clientName: "AITTC", supervisorName: "Yassine ELBEQQAL", surfaceM2: 0, dateStr: "A lancer", status: "A_LANCER", activityTypeLabel: "Ornementale et Espaces Verts" },
  { title: "Entretien des espaces verts de l'AITTC", fieldName: "A la ferme", clientName: "AITTC", supervisorName: "Yassine ELBEQQAL", surfaceM2: 10000, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Ornementale et Espaces Verts" },
  { title: "Smart Farm-OCP Agribiotech", fieldName: "A la ferme", clientName: "Smart Pharm", supervisorName: "Yasmine TAOUIR", surfaceM2: 40000, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Agriculture de Précision" },
  { title: "AgriEdge 1", fieldName: "A la ferme", clientName: "Agri Edge", supervisorName: "Yasmine TAOUIR", surfaceM2: 1727, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Agriculture de Précision" },
  { title: "AgriEdge 2", fieldName: "A la ferme", clientName: "Agri Edge", supervisorName: "Yasmine TAOUIR", surfaceM2: 50000, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Agriculture de Précision" },
  { title: "Installation parcelles pour étudiants-ESSAFE", fieldName: "A la ferme", clientName: "ESAFE", supervisorName: "Yassine ELBEQQAL", surfaceM2: 2200, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Développement et Formation" },
  { title: "Installation de la parcelle master exécutive (Agriculture de précision)-ESSAFE", fieldName: "A la ferme", clientName: "ESAFE", supervisorName: "Yassine ELBEQQAL", surfaceM2: 10000, dateStr: "Programme", status: "PROGRAMME", activityTypeLabel: "Développement et Formation" },

  // --- Page 2 ---
  { title: "Projet aménagement et entretien des espaces verts UM6P et CCI", fieldName: "Site externe", clientName: "UM6P", supervisorName: "Yassine ELBEQQAL", surfaceM2: 0, dateStr: "A développer", status: "A_LANCER", activityTypeLabel: "Ornementale et Espaces Verts" },
  { title: "Projet aménagement site OCP JORF LASFAR", fieldName: "Site externe", clientName: "OCP JORF LASFAR", supervisorName: "Jelloul FNIZI", surfaceM2: 0, dateStr: "A développer", status: "A_LANCER", activityTypeLabel: "Ornementale et Espaces Verts" },
  { title: "Commercialisation huiles EMMYOR", fieldName: "A la ferme", clientName: "EMINES", supervisorName: "Yassine ELBEQQAL", surfaceM2: 2500, dateStr: "Programme", status: "FINALISE", activityTypeLabel: "Commercialisation" },
];


// =========================================================================================
// SEEDING SCRIPT
// =========================================================================================

/**
 * Parses a flexible date string from the document into a Date object.
 * @param {string} dateStr - The date string (e.g., "MM-YYYY", "DD-MM-YY").
 * @returns {Date|null} A Date object or null if parsing fails.
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Format: DD-MM-YY or DD/MM/YYYY
  let match = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  // Format: MM-YYYY
  match = dateStr.match(/^(\d{1,2})-(\d{4})$/);
  if (match) {
    const month = parseInt(match[1], 10) - 1;
    const year = parseInt(match[2], 10);
    return new Date(year, month, 1);
  }
  
  // Format: YYYY
  match = dateStr.match(/^(\d{4})$/);
  if (match) {
      return new Date(parseInt(match[1], 10), 0, 1);
  }

  return null;
}

/**
 * Parses a date range string from the document.
 * @param {string} rangeStr - The full date string from the PDF.
 * @returns {{startDate: Date|null, endDate: Date|null}}
 */
function parseDateRange(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') return { startDate: null, endDate: null };

  const lowerCaseStr = rangeStr.toLowerCase();

  if (lowerCaseStr.includes('depuis') || lowerCaseStr.includes('mois')) {
    const datePart = lowerCaseStr.replace('depuis', '').replace('mois', '').trim();
    return { startDate: parseDate(datePart) || parseDate(datePart.replace(' ','-')), endDate: null };
  }

  if (lowerCaseStr.includes('à l\'infeni')) {
    const [startPart] = lowerCaseStr.split("à l'infeni");
    return { startDate: parseDate(startPart.trim()), endDate: null };
  }

  if (lowerCaseStr.includes('au')) {
    const [startPart, endPart] = lowerCaseStr.split('au').map(s => s.trim());
    return { startDate: parseDate(startPart), endDate: parseDate(endPart) };
  }

  // If no range keyword, assume it's just a start date
  const singleDate = parseDate(lowerCaseStr);
  if(singleDate) return { startDate: singleDate, endDate: null };

  return { startDate: null, endDate: null };
}

async function seed() {
  try {
    console.log('🌱 Starting database seeding based on F.75 document...');

    // Clear existing data in the correct order to avoid foreign key conflicts
    console.log('🧹 Clearing existing data...');
    await prisma.project.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.priceOffer.deleteMany();
    await prisma.serviceOrder.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.user.deleteMany();
    await prisma.field.deleteMany();
    await prisma.activityType.deleteMany();
    await prisma.entity.deleteMany();

    // 1. Create Entities
    console.log('🏢 Creating entities...');
    const createdEntities = {};
    for (const entity of entities) {
      const newEntity = await prisma.entity.create({ data: entity });
      createdEntities[entity.name] = newEntity;
    }
    console.log(`   ...${Object.keys(createdEntities).length} entities created.`);

    // 2. Create Activity Types
    console.log('🏷️ Creating activity types...');
    const createdActivityTypes = {};
    for (const type of activityTypes) {
      const newType = await prisma.activityType.create({ data: type });
      createdActivityTypes[type.label] = newType;
    }
    console.log(`   ...${Object.keys(createdActivityTypes).length} activity types created.`);

    // 3. Calculate Field Surface and Create Fields
    console.log('🌾 Calculating surface usage and creating fields...');
    const fieldUsage = {};
    for (const field of fields) {
        fieldUsage[field.name] = 0;
    }
    for (const project of projects) {
        if(fieldUsage.hasOwnProperty(project.fieldName)) {
            fieldUsage[project.fieldName] += project.surfaceM2;
        }
    }
    const createdFields = {};
    for (const field of fields) {
      const totalSurfaceM2 = fieldUsage[field.name];
      const newField = await prisma.field.create({
        data: {
          name: field.name,
          location: field.location,
          // Set total surface to used surface + 20% buffer, and free surface to that buffer.
          totalSurfaceM2: Math.ceil(totalSurfaceM2 * 1.2),
          freeSurfaceM2: Math.ceil(totalSurfaceM2 * 0.2),
        },
      });
      createdFields[field.name] = newField;
    }
     console.log(`   ...${Object.keys(createdFields).length} fields created.`);

    // 4. Create Users (including a default Admin)
    console.log('👥 Creating users...');
    // Admin User
    const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12);
    await prisma.user.create({
      data: {
        email: process.env.ADMIN_EMAIL || 'admin@aittc.ma',
        passwordHash: adminPasswordHash,
        name: process.env.ADMIN_NAME || 'System Administrator',
        role: 'ADMIN',
        isVerified: true,
      },
    });

    // Users from the document
    const createdUsers = {};
    const defaultPasswordHash = await bcrypt.hash('password123', 12);
    for (const user of users) {
      if (user.inconnu_client_1) continue; // Skip specific placeholders if any
      if (user.inconnu_client_2) continue; // Skip specific placeholders if any
      const entityId = createdEntities[user.entityName]?.id;
      const newUser = await prisma.user.create({
        data: {
          email: user.email,
          passwordHash: defaultPasswordHash,
          name: user.name,
          role: user.role,
          entityId,
          isVerified: true,
        },
      });
      createdUsers[user.name] = newUser;
    }
    // Create dedicated users for entity clients if not already present
    const entityClientNames = ['AITTC', 'Smart Pharm', 'Agri Edge', 'ESAFE', 'UM6P', 'OCP JORF LASFAR', 'EMINES'];
    for (const entityName of entityClientNames) {
      if (!createdUsers[entityName]) {
        const entityId = createdEntities[entityName]?.id;
        const newUser = await prisma.user.create({
          data: {
            email: `${entityName.toLowerCase().replace(/[^a-z0-9]/g, '')}@entityclient.ma`,
            passwordHash: defaultPasswordHash,
            name: entityName,
            role: 'CLIENT',
            entityId,
            isVerified: true,
          },
        });
        createdUsers[entityName] = newUser;
      }
    }
    // Find a default supervisor and client for fallback
    const defaultSupervisor = Object.values(createdUsers).find(u => u.role === 'SUPERVISOR');
    const defaultClient = Object.values(createdUsers).find(u => u.role === 'CLIENT');

    console.log(`   ...${Object.keys(createdUsers).length + 1} users created.`);


    // 5. Create Projects
    console.log('📋 Creating projects...');
    let projectCount = 0;
    for (const projectData of projects) {
      const { startDate, endDate } = parseDateRange(projectData.dateStr);
      // Look up foreign keys robustly
      const field = createdFields[projectData.fieldName] || Object.values(createdFields)[0];
      const client = createdUsers[projectData.clientName] || createdUsers[projectData.clientName?.trim()] || defaultClient;
      const supervisor = createdUsers[projectData.supervisorName] || createdUsers[projectData.supervisorName?.trim()] || defaultSupervisor;
      const activityType = createdActivityTypes[projectData.activityTypeLabel];
      // Map status from PDF string to schema enum
      let statusEnum = 'A_LANCER';
      if (projectData.status.toLowerCase().includes('finalisé')) statusEnum = 'FINALISE';
      if (projectData.status.toLowerCase().includes('en cours')) statusEnum = 'EN_COURS';
      if (projectData.status.toLowerCase().includes('programme')) statusEnum = 'PROGRAMME';
      if (projectData.status.toLowerCase().includes('lancer')) statusEnum = 'A_LANCER';
      await prisma.project.create({
        data: {
          title: projectData.title,
          surfaceM2: projectData.surfaceM2,
          status: statusEnum,
          startDate: startDate || new Date(),
          endDate,
          fieldId: field.id,
          clientId: client.id,
          supervisorId: supervisor.id,
          activityTypeId: activityType?.id,
        },
      });
      projectCount++;
    }
    console.log(`   ...${projectCount} projects created.`);


    console.log('✅ Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();