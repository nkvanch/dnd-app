// __mocks__/react-native-tcp-socket.js
// Manual Jest mock for the native TCP socket module. Jest's test environment
// has no real native bridge, so importing the real package crashes at
// require-time (`new NativeEventEmitter()` inside its own Globals.js runs
// the moment the module loads, regardless of whether anything in it is
// actually called). This is standard practice for testing any React Native
// app that uses native modules — Jest auto-picks up a manual mock placed
// here (root-level __mocks__/<package-name>.js) for any node_modules
// package, no per-test-file `jest.mock()` call needed.
//
// None of the current test suites (src/engine/**, src/sync/**) actually
// call into sync at runtime — they only transitively import characterStore.ts
// (for makeEmptyEntity/DEFAULT_RULES), which imports the sync layer, which
// imports this package. This stub just needs to load without crashing; the
// functions below are safe no-ops in case anything ever does call them.

function noop() {}

function makeFakeSocket() {
  return {
    on: noop,
    write: noop,
    destroy: noop,
    end: noop,
  };
}

module.exports = {
  createServer: () => ({
    listen: (_opts, cb) => { if (cb) cb(); },
    on: noop,
    close: noop,
  }),
  createConnection: () => makeFakeSocket(),
};
