# ConfusionsDaltonisme.jsx — couleurs voisines que les daltoniens confondent (Adobe Illustrator)

**FR** · Trouve, dans une carte, un schéma, un graphique, une signalétique ou un emballage, les **couleurs différentes qui se touchent** (ou un **texte posé sur un fond**) que les personnes **daltoniennes** ne peuvent plus distinguer, puis les sélectionne, les signale ou propose **la plus petite retouche de couleur** qui règle la confusion sans en créer d'autre avec les voisins.
**EN** · Finds **different colours that touch each other** (or **text over a background**) in a map, diagram, chart, sign or package that **colour-blind** viewers can no longer tell apart, then selects them, flags them or proposes **the smallest colour change** that fixes the confusion without creating a new one with the neighbours.

> Version 1.0.0 · Illustrator CC 2018 – 2026 (ExtendScript) · **Non testé dans Illustrator** (voir « Statut des tests »).
> Travaillez sur une copie du fichier. Les corrections se défont avec Ctrl/Cmd+Z.

## À quoi ça sert

Environ 8 % des hommes et 0,5 % des femmes voient mal certaines couleurs. Un plan de métro, une carte de zones, un camembert, une légende, un code couleur de parfums sur un emballage ou un « Sortie » rouge sur fond vert peuvent devenir illisibles pour eux.

Illustrator sait **montrer** une simulation (*Affichage > Format d'épreuve > Daltonisme*), mais il faut alors parcourir tout le document à l'œil, deux fois, et deviner quelle couleur changer et de combien. Ce script fait le travail :

1. il repère les zones colorées **réellement voisines** (bords communs, objets inclus l'un dans l'autre, trait posé sur une zone, texte sur un fond) ;
2. il simule chaque couleur pour la **protanopie**, la **deutéranopie**, la **tritanopie** et, si on le demande, le **noir et blanc** (photocopie, impression monochrome) ;
3. il signale les paires **distinctes en vision normale mais confondues** dans au moins une de ces visions ;
4. il calcule pour chaque paire une **retouche minimale** (surtout de clarté, la seule différence qui survit à tous les daltonismes) qui reste distincte de **tous** les voisins de la couleur, dans **toutes** les visions cochées.

## Pourquoi c'est nouveau (vérifié le 17/10/2026)

- **Fonction native** : *Format d'épreuve > Daltonisme* ne fait qu'afficher une simulation (protanopie et deutéranopie seulement) ; rien ne dit quelles couleurs posent problème ni où.
- **Scripts Illustrator existants** : `ColorBlindSimulator.jsx` de **creold** (et sa reprise dans **vexy-illustrator-scripts**) simule ou **remplace** les couleurs de la sélection par leur version simulée, mais ne compare aucune paire et ne trouve pas les voisins confondus. Les « Contrast Checker » (creold, Samolevsky, vexy) mesurent le contraste WCAG d'une paire choisie à la main, pas le daltonisme. Listes passées en revue : creold, Hiroyuki Sato (shspage), John Wundes, Alexander Ladygin, wckdtall, Kelso Cartography, Josh Duncan, sttk3, vexy : aucun contrôle de couleurs voisines.
- **GitHub** : la recherche de code « deuteranopia » dans les fichiers `.jsx` ne renvoie, pour Illustrator, que le simulateur de creold.
- **Hors d'Illustrator** : Adobe Color (outils d'accessibilité) et des outils comme colorblindcheck (R) vérifient une **palette** dans un navigateur ou en code, sans lire le document, sans savoir quelles couleurs se touchent, et sans corriger le fichier.

## Ce que le script prend en compte

- **Formes réelles** : courbes de Bézier aplaties, tracés composés avec trous (pair-impair / non nul), traits ouverts et contours fermés avec leur épaisseur, objets inclus l'un dans l'autre sans bord commun.
- **Distance réglable** : deux zones séparées par un filet blanc de moins de 1 mm (réglable) sont considérées voisines.
- **Contours séparateurs** : si une zone a un contour net (0,75 pt par défaut) **bien distinct des deux couleurs** pour toutes les visions, le contact est considéré comme séparé (c'est la correction conseillée par Adobe) ; option désactivable.
- **Texte sur fond** : chaque couleur de texte d'un bloc est comparée aux fonds qu'il recouvre (cadre du bloc).
- **Masques d'écrêtage** : un contact situé hors du masque le plus proche est ignoré.
- **Couleurs** : RVB, CMJN (converti par Illustrator selon le profil du document), niveaux de gris, tons directs et couleurs globales avec leur teinte (base CMJN, RVB, Lab ou gris). Le repérage est ignoré.
- **Mode « toutes entre elles »** pour un graphique et sa légende (les couleurs ne se touchent pas mais doivent se distinguer), ou pour vérifier une palette.
- Calques masqués, objets masqués, objets/calques verrouillés et calques non imprimables ignorés (options).

### Mesures utilisées

- Simulation : matrices de **Machado, Oliveira & Fernandes (2009)** appliquées en RVB linéaire (sRGB). Sévérité **forte** (dichromatie, choix prudent) ou **moyenne** (≈ 60 %, approximation par interpolation pour les anomalies, plus fréquentes).
- Écart : **ΔE 2000** (CIEDE2000, Sharma 2005) en L\*a\*b\* D65. Seuil **souple 7**, **recommandé 10**, **strict 14**. Avec le seuil recommandé, la palette d'Okabe-Ito (conçue pour les daltoniens) passe sans aucune confusion, tandis que le rouge et le vert de la palette « tab10 » sont signalés (ΔE 4,6 en deutéranopie).
- Une paire déjà proche pour tout le monde (ΔE normal sous le seuil, par exemple deux teintes voulues d'une même couleur) n'est pas comptée comme une confusion.

### Corrections proposées

- On retouche la couleur **la moins utilisée** de la paire (surface), dans **son propre espace** : RVB (clarté, puis saturation et teinte légères), CMJN (encrage et noir, une encre de plus ou de moins), gris, et pour un **ton direct, seulement sa teinte** (le ton direct est gardé).
- Le candidat retenu est **le plus proche de la couleur d'origine** (ΔE 2000) parmi ceux qui restent distincts, avec une marge de 1,5, de **tous** les voisins de cette couleur dans **toutes** les visions cochées ; la retouche est plafonnée à ΔE 25.
- Si aucune retouche simple ne convient, le script le dit : ajoutez un contour, un motif ou un libellé.
- Seuls les objets de la zone analysée qui portent exactement cette couleur sont modifiés ; les objets verrouillés ne sont pas touchés.

## Installation

- **Sans installer** : Illustrator → *Fichier > Scripts > Autre script…* (*File > Scripts > Other Script…*) → choisir `ConfusionsDaltonisme.jsx`.
- **Dans le menu** : copier `ConfusionsDaltonisme.jsx` dans le dossier `Presets/<langue>/Scripts` d'Illustrator (Windows : `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\fr_FR\Scripts` ; macOS : `/Applications/Adobe Illustrator <version>/Presets.localized/fr_FR/Scripts`), puis redémarrer Illustrator.

## Utilisation

1. Ouvrez une **copie** du fichier et lancez le script.
2. Choisissez **où chercher** (sélection, plan de travail actif, document) et **quoi comparer** (zones qui se touchent, ou toutes les couleurs entre elles), les visions à simuler, le seuil et la sévérité.
3. La liste montre chaque paire : couleur A, couleur B, visions concernées avec le plus petit écart simulé, et la **correction proposée** (« A → C0 M85 J90 N0 (ΔE 6,2) »).
4. Sélectionnez des lignes puis choisissez :
   - **Sélectionner les objets** concernés ;
   - **Signaler** : cercles numérotés aux points de contact, sur le calque non imprimable et verrouillé « Daltonisme – contrôle » (refait à chaque analyse) ;
   - **Appliquer les corrections** (une seule exécution, annulable).
5. **Enregistrer le rapport…** écrit un fichier .txt (paires, écarts par vision, corrections) pour le BAT.

L'interface est en français, ou en anglais si Illustrator n'est pas en français.

## Limites connues

- Les dégradés, motifs, filets, images, symboles et effets ne sont pas analysés (ils sont comptés et annoncés).
- L'ordre d'empilement n'est pas pris en compte : une zone entièrement cachée par une autre peut créer un contact qui ne se voit pas.
- Le texte est représenté par son cadre, pas par la forme des lettres ; la transparence et les modes de fusion ne sont pas simulés.
- Les masques de calque ne sont pas lus (seuls les groupes de masque).
- La simulation est un modèle : elle ne remplace pas un essai avec des personnes concernées.

## Statut des tests

**Non testé dans Illustrator.** Vérifications faites sur l'ordinateur :

- syntaxe ES3 et ES5 (acorn) ;
- `tests/test-core.js` (moteur pur) : ΔE 2000 sur 12 paires de référence de Sharma 2005 (dans les deux sens) et égal à la bibliothèque [color-diff](https://github.com/markusn/color-diff) (MIT, utilisée seulement pour les tests) sur 20 000 paires L\*a\*b\* aléatoires (écart max 1e-13) ; conversion L\*a\*b\* égale à [culori](https://culori.js.org/) (MIT, tests seulement) à 0,014 près sur 3 000 couleurs ; coefficients des matrices de Machado identiques à ceux de culori ; gris conservés par toutes les simulations ; aller-retour RVB ↔ Lab sur 2 000 couleurs ; paires connues (rouge/vert confondus, palette Okabe-Ito sans confusion, Okabe-Ito confondue en noir et blanc) ; géométrie (bord à bord, inclusion, trou d'un tracé composé, trait traversant, contour fermé, masque, cercle de Bézier, 3 000 paires de rectangles aléatoires sans erreur, balayage identique à la force brute) ; contours séparateurs ; corrections : sur 141 bandes aléatoires de six couleurs ayant des confusions, 141 entièrement réglées, aucune nouvelle confusion créée, reste annoncé = reste réel, retouche minimale parmi les candidats, CMJN gardé en CMJN, ton direct corrigé par sa teinte ;
- `tests/test-mock.js` : 43 vérifications sur un DOM Illustrator et des fenêtres ScriptUI simulés (carte rouge/vert/bleu, texte sur fond, calques masqués / verrouillés / non imprimables, dégradé ignoré, sélection, plan de travail, masque d'écrêtage, tracé composé à trou, ton direct, document CMJN, contour séparateur, calque de contrôle remplacé à chaque analyse et jamais analysé, groupes imbriqués sans doublon même sans `uuid`, parcours complet Signaler / Sélectionner / Corriger puis réanalyse à zéro confusion, messages sans document, sans couleur, sans confusion, Annuler, interface anglaise) ;
- 16 mutations volontaires du code : 15 détectées par les tests, la 16ᵉ étant sans effet (contrôle en double).

Lancer les tests : `node tests/test-core.js && node tests/test-mock.js` (culori et color-diff facultatifs : `npm install culori color-diff`).

## Licence

MIT © 2026 Amirouche Amwanes — voir [LICENSE](LICENSE). Aucun code tiers n'est inclus dans le script ; les formules publiées (Machado 2009, CIEDE2000, sRGB) sont réimplémentées.
