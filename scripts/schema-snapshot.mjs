/**
 * Photographie du schéma de la base, pour que les tests puissent vérifier que
 * le code ne demande pas une colonne qui n'existe pas.
 *
 * ⚠️⚠️ POURQUOI CE FICHIER EXISTE : le client Supabase NE JETTE PAS. Une
 * requête qui cite une colonne absente est refusée ENTIÈREMENT par PostgREST
 * (42703), la promesse se résout quand même, et le code lit `data: null` comme
 * « ce trader n'a rien ». Trois lectures du produit vivaient dans cet état
 * depuis des semaines sans une ligne de journal : les statistiques envoyées au
 * coach, l'outil de performance par dimension, et le classement du coach.
 * Aucun des 3 043 tests ne pouvait le voir : ils ne parlent jamais à la base.
 *
 * Régénérer après chaque migration :  npm run schema:sync
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = {};
for (const ligne of fs.readFileSync(path.join(racine, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = ligne.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const cle = env.SUPABASE_SERVICE_ROLE_KEY;
if (!cle) {
  console.error('SUPABASE_SERVICE_ROLE_KEY absente de .env.local');
  process.exit(1);
}

const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: cle, Authorization: `Bearer ${cle}` },
});
if (!res.ok) {
  console.error('Lecture du schéma impossible :', res.status, await res.text());
  process.exit(1);
}
const swagger = await res.json();

const schema = {};
for (const [table, def] of Object.entries(swagger.definitions || {})) {
  schema[table] = Object.keys(def.properties || {}).sort();
}

const sortie = path.join(racine, 'lib', 'schema-base.json');
fs.writeFileSync(sortie, JSON.stringify(schema, null, 2) + '\n', 'utf8');
console.log(`${Object.keys(schema).length} tables écrites dans lib/schema-base.json`);
