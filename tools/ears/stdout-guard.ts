// Imported first by main.ts. In server mode stdout carries only protocol messages, so anything a
// library prints with console.log is sent to stderr instead. ES imports run in order, so this
// runs before the other modules load.
console.log = console.error;
