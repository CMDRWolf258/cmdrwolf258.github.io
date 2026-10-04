// Only schema readiness is cached. Every data read/write still goes to D1.
// Each deployed Worker isolate starts with an empty cache; each binding is separate.
const schemasByDatabase = new WeakMap();

export function invalidateDatabaseSchemas(database) {
  schemasByDatabase.delete(database);
}

export function oncePerDatabase(initialize) {
  const schema = Symbol('schema readiness');
  return function ensureSchema(env) {
    const database = env.DB;
    let schemas = schemasByDatabase.get(database);
    if (!schemas) {
      schemas = new Map();
      schemasByDatabase.set(database, schemas);
    }
    const existing = schemas.get(schema);
    if (existing) return existing;
    const pending = Promise.resolve().then(() => initialize(env)).catch(error => {
      // A quota or transient error must allow a later request to retry.
      if (schemasByDatabase.get(database) === schemas && schemas.get(schema) === pending) {
        schemas.delete(schema);
      }
      throw error;
    });
    schemas.set(schema, pending);
    return pending;
  };
}
