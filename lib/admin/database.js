import { prisma } from "@/lib/prisma";

/**
 * Resynchronizes all PostgreSQL sequences to match the maximum ID in their respective tables.
 * This fixes "duplicate key value violates unique constraint" or "Unique constraint failed on the fields: (id)"
 * errors on subsequent inserts after restoring/importing records with explicit IDs.
 */
export async function syncDatabaseSequences(tx = prisma) {
  try {
    // 1. Dynamic PostgreSQL sequence resynchronization for all sequences in the public schema
    await tx.$executeRawUnsafe(`
      DO $$
      DECLARE
        rec RECORD;
        max_val BIGINT;
        cnt BIGINT;
      BEGIN
        FOR rec IN
          SELECT 
            t.relname AS table_name,
            a.attname AS column_name,
            s.relname AS sequence_name
          FROM pg_class s
          JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.deptype IN ('a', 'i')
          JOIN pg_class t ON t.oid = d.refobjid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
          WHERE s.relkind = 'S'
        LOOP
          EXECUTE format('SELECT COALESCE(MAX(%I), 1), COUNT(*) FROM %I', rec.column_name, rec.table_name)
          INTO max_val, cnt;

          IF cnt > 0 THEN
            EXECUTE format('SELECT setval(%L, %s, true)', '"' || rec.sequence_name || '"', max_val);
          ELSE
            EXECUTE format('SELECT setval(%L, 1, false)', '"' || rec.sequence_name || '"');
          END IF;
        END LOOP;
      END $$;
    `);
  } catch (err) {
    console.warn("[database-sync] Dynamic sequence scan warning, applying targeted fallback:", err.message);
    // 2. Direct fallback for Compte_id_seq
    try {
      await tx.$executeRawUnsafe(`
        SELECT setval(
          '"Compte_id_seq"',
          COALESCE((SELECT MAX("id") FROM "Compte"), 1),
          (SELECT COUNT(*) > 0 FROM "Compte")
        );
      `);
    } catch (fallbackErr) {
      console.warn("[database-sync] Fallback sequence sync error:", fallbackErr.message);
    }
  }
}

