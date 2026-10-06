import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('consumer release pause protects all writes while preserving historical evidence', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE quotes (id int PRIMARY KEY, customer_type text);
      CREATE TABLE contract_summaries (id int PRIMARY KEY, customer_type text,
        status text, document_status text, is_information_update boolean, pdf_sha256 text);
      CREATE TABLE contract_information_packs (id int PRIMARY KEY, quote_id int, document_status text);
      CREATE TABLE contract_acceptances (id int PRIMARY KEY, contract_summary_id int);
      INSERT INTO quotes VALUES (1, 'residential'), (2, 'business');
      INSERT INTO contract_summaries VALUES
        (1,'residential','accepted','accepted',false,'original-pdf-hash'),
        (2,'residential','issued','issued',false,'unaccepted-pdf-hash'),
        (3,'business','issued','issued',false,'business-pdf-hash');
      INSERT INTO contract_information_packs VALUES (1,1,'accepted'), (2,1,'issued');
      INSERT INTO contract_acceptances VALUES (1,1);
    `);
    const before = await db.query('SELECT * FROM contract_summaries WHERE id=1');
    const migration = readdirSync('supabase/migrations').find(n => n.endsWith('_consumer_contract_release_pause.sql'));
    assert.ok(migration, 'tracked release migration exists');
    await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'));
    for (const sql of [
      "INSERT INTO contract_summaries VALUES (4,'residential','issued','issued',false,null)",
      "INSERT INTO contract_summaries VALUES (4,null,'issued','issued',false,null)",
      "UPDATE contract_summaries SET status='accepted' WHERE id=2",
      "UPDATE contract_summaries SET document_status='accepted' WHERE id=2",
      "INSERT INTO contract_information_packs VALUES (3,1,'issued')",
      "INSERT INTO contract_information_packs VALUES (3,999,'issued')",
      "UPDATE contract_information_packs SET document_status='accepted' WHERE id=2",
      "INSERT INTO contract_acceptances VALUES (2,2)",
      "INSERT INTO contract_acceptances VALUES (2,1)", // no historical backfill
      "INSERT INTO contract_acceptances VALUES (2,999)",
    ]) {
      await assert.rejects(db.exec(sql), /consumer_contract_issuance_paused/, sql);
    }
    assert.deepEqual(await db.query('SELECT * FROM contract_summaries WHERE id=1'), before);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM contract_acceptances')).rows[0].n, 1);
    await db.exec("INSERT INTO contract_summaries VALUES (4,'business','issued','issued',false,null)");
    await db.exec("INSERT INTO contract_information_packs VALUES (3,2,'issued')");
    await db.exec("INSERT INTO contract_acceptances VALUES (2,3)");
    // Existing records-only information refresh remains permitted; existing
    // information-update triggers separately forbid signing it.
    await db.exec("INSERT INTO contract_summaries VALUES (5,'residential','issued','issued',true,null)");
  } finally {
    await db.close();
  }
});
