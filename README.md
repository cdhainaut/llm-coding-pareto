# LLM coding cost / intelligence Pareto

Dataset léger pour suivre le compromis **coût API vs performance coding** des modèles LLM, avec un focus sur les familles actuelles :

- OpenAI GPT‑5.6 (`sol-xhigh` pour l'instant) ;
- Anthropic Claude Opus / Fable, y compris variantes `thinking` ;
- Moonshot/Kimi (`kimi-k3`, `k2.6`, etc.) ;
- DeepSeek, MiniMax, GLM, Qwen, Gemini.

Le but est de produire un **front de Pareto coût → coding Elo** et des visualisations mises à jour automatiquement.

## Sources

### Source principale — `sanand0/llmpricing`

Le fichier `data/elo.csv` est téléchargé depuis :

```text
https://raw.githubusercontent.com/sanand0/llmpricing/master/elo.csv
```

Ce CSV combine notamment :

- `model` : nom du modèle / variante ;
- `overall`, `hard`, `coding` : scores LMArena ;
- `cpmi` : coût input en USD / million de tokens ;
- `launch`, `end` : dates approximatives ;
- `source` : source de prix.

### Sources complémentaires prévues

- OpenRouter API `/api/v1/models` : prix input/output et métadonnées de raisonnement ;
- LMArena : scores de leaderboard ;
- Artificial Analysis : indices coding / agentic en comparaison.

## Schéma actuel

Le repo utilise directement le schéma upstream :

```text
model, overall, hard, coding, cpmi, launch, end, source
```

Champs clés pour le Pareto :

- `coding` : score coding Elo ;
- `cpmi` : coût input en $ / million de tokens.

Une variante de modèle avec `thinking` ou un niveau de raisonnement est traitée comme un point distinct si elle apparaît comme une entrée distincte dans la source.

## Scripts

### Mettre à jour les données

```bash
python scripts/update_data.py
```

Télécharge le dernier `elo.csv` upstream dans `data/elo.csv`.

### Générer les figures

```bash
python scripts/build_pareto.py
```

Produit :

- `assets/coding_pareto.png` ;
- `assets/coding_pareto_interactive.html` ;
- `assets/coding_pareto_frontier.csv` ;
- `assets/coding_pareto_animation.gif` si les dépendances GIF sont disponibles.

Le script filtre les modèles sans `coding` ou sans `cpmi`, puis calcule le front de Pareto en minimisant le coût et en maximisant le score coding.

## Site statique

Le dossier `web/` contient une petite application statique Plotly :

- sélection de l'année ;
- filtre par provider ;
- filtre par niveau de raisonnement ;
- filtre coût max ;
- recherche modèle ;
- option pour n'afficher que le front de Pareto.

La donnée web est générée dans `web/data/models.json` par :

```bash
python scripts/build_web.py
```

## CI / GitHub Pages

La GitHub Action `.github/workflows/update-pareto.yml` met à jour les données et assets une fois par mois.

La GitHub Action `.github/workflows/pages.yml` :

1. télécharge `elo.csv` ;
2. génère `web/data/models.json` ;
3. déploie le dossier `web/` sur GitHub Pages ;
4. s'exécute mensuellement, sur modification de `web/`, ou manuellement.

## Limites

- `coding` vient d'un leaderboard LMArena : ce n'est pas une validation scientifique ou métier.
- `cpmi` est le coût input seul ; output, cache et coûts de raisonnement ne sont pas intégrés.
- Les variantes `thinking` dépendent des entrées disponibles dans la source ; toutes les combinaisons modèle × niveau de raisonnement ne sont pas forcément benchmarkées.
- Les données de lancement/fin sont approximatives.
