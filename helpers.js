
const { createAdapter } = require("@most/adapter");
const { newDefaultScheduler } = require('@most/scheduler');
const { runEffects, tap, until, filter, map, combine, now, mergeArray } =require('@most/core');

const { fromEntries, values, keys } = Object;

const identityTransformer = stream$ => stream$;


const log = (prefix) => (...args) => console.log(`[${prefix}]`, ...args);
const log$ = prefix => tap(log(prefix));

const skipObjectRepeats = $stream => skipRepeatsWith(objectEqual, $stream);

const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

const pipe2 = (x,...fns) => fns.reduce((v, f) => f(v), x);

function eventToObservable(transformer = identityTransformer) {
    const [dispatch, event$] = createAdapter();
    return [dispatch, transformer(event$)];
}

const streamify = f => (...args$) => map(args => f(...args), combineToArray(...args$));

// list of streams is converted to a stream of lists
const combineToArray = (s1$, ...s$) => {
    if (s$.length === 0)
        return map(v => [v]);
    if (s$.length === 1)
        return combine((v1, v2) => [v1, v2], s1$, ...s$);

    const [s2$, ...s_rest$] = s$;
    return map(([combined, ...arr]) => [...combined, ...arr], combineToArray(combine((v1, v2) => [v1, v2], s1$, s2$), ...s_rest$));
}

const oOf$To$OfO = o => map(vals => fromEntries(vals.map((val, i) => [keys(o)[i].replace(/\$$/, ""), val])), combineToArray(...values(o)));


const notNull = o => o != null;

const drain = (s$) => runEffects(s$, newDefaultScheduler())



const objectEqual = (o1, o2) => JSON.stringify(o1) == JSON.stringify(o2);
const fromArray$ = a => mergeArray(a.map(now));


module.exports = {identityTransformer,log,log$,skipObjectRepeats, pipe, eventToObservable,streamify, oOf$To$OfO, notNull, drain,pipe2,fromArray$ };