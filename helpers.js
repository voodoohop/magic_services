

const { fromEntries, values, keys } = Object;

const identityTransformer = stream$ => stream$;


const log = (prefix) => (...args) => console.log(`[${prefix}]`, ...args);

const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

const pipe2 = (x,...fns) => fns.reduce((v, f) => f(v), x);


const notNull = o => o != null;


const objectEqual = (o1, o2) => JSON.stringify(o1) == JSON.stringify(o2);

module.exports = {identityTransformer,log, pipe,  notNull, drain,pipe2};