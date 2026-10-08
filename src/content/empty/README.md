# Empty catalog modules

In the app, the built-in catalog is not shipped: `metro.config.js` replaces each module listed there with the file of the same name here, which
exports the same names with nothing in them. Content comes only from installed packs (src/content/provider, officialSource.ts).
Jest and the build scripts use the real modules (they are the source the packs are built from). A test (packsOnlyBundle.test.ts) checks that
every name the app imports from a replaced module is exported here and that no catalog data is reachable from the app.
