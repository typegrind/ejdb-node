/**************************************************************************************************
 *  NodeJS API for EJDB database library http://ejdb.org
 *  Copyright (C) 2012-2013 Softmotions Ltd <info@softmotions.com>
 *
 *  This file is part of EJDB.
 *  EJDB is free software; you can redistribute it and/or modify it under the terms of
 *  the GNU Lesser General Public License as published by the Free Software Foundation; either
 *  version 2.1 of the License or any later version.  EJDB is distributed in the hope
 *  that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public
 *  License for more details.
 *  You should have received a copy of the GNU Lesser General Public License along with EJDB;
 *  if not, write to the Free Software Foundation, Inc., 59 Temple Place, Suite 330,
 *  Boston, MA 02111-1307 USA.
 *************************************************************************************************/

var binary = require('node-pre-gyp');
var path = require('path');
var ejdblib_path = binary.find(path.resolve(path.join(__dirname,'./package.json')));
var ejdblib = require(ejdblib_path);

var EJDBImpl = ejdblib.NodeEJDB;

const DEFAULT_OPEN_MODE = (ejdblib.JBOWRITER | ejdblib.JBOCREAT);
var EJDB = function() {
    Object.defineProperty(this, "_impl", {
        value : new EJDBImpl(),
        configurable : false,
        enumerable : false,
        writable : false
    });
    return this;
};

for (var k in ejdblib) { //Export constants
    if (k.indexOf("JB") === 0) {
        EJDB[k] = ejdblib[k];
    }
}
EJDB.DEFAULT_OPEN_MODE = DEFAULT_OPEN_MODE;

/**
 * Open database.
 * Return database instance handle object .
 *
 * Default open mode: JBOWRITER | JBOCREAT
 *
 * Depending on if cb parameter is passed this function is either async or
 * blocking.
 *
 * @param {String} dbFile Database main file name
 * @param {Number} openMode [JBOWRITER | JBOCREAT | ..] Bitmast of open modes:
 *      - `JBOREADER` Open as a reader.
 *      - `JBOWRITER` Open as a writer.
 *      - `JBOCREAT` Create db if it not exists
 *      - `JBOTRUNC` Truncate db.
 * @param {Function} [cb] Callback called with error and EJDB object arguments.
 * @returns {EJDB} EJDB database wrapper
 */

EJDB.open = function(dbFile, openMode, cb) {
    var db = new EJDB();
    var mode = (openMode > 0) ? openMode : DEFAULT_OPEN_MODE;

    if (cb) {
        db._impl.open(dbFile, mode, function (err) {
            cb(err, db);
        });
        return;
    }
    db._impl.open(dbFile, mode);
    return db;
};


/**
 * Returns true if argument is valid object id (OID) string.
 * @param {String} oid Object id.
 * @return {Boolean}
 */
EJDB.isValidOID = function(oid) {
    if (typeof oid !== "string" || oid.length !== 24) {
        return false;
    }
    var i = 0;
    //noinspection StatementWithEmptyBodyJS
    for (; ((oid[i] >= 0x30 && oid[i] <= 0x39) || /* 1 - 9 */
            (oid[i] >= 0x61 && oid[i] <= 0x66)); /* a - f */
           ++i);
    return (i === 24);
};

/**
 * Close database.
 * If database was not opened it does nothing.
 *
 * Depending on if cb parameter is passed this function is either async or
 * blocking.
 *
 * @param {Function} [cb] Callback called with error argument.
 */
EJDB.prototype.close = function(cb) {
    return this._impl.close(cb);
};

/**
 * Check if database in opened state.
 */
EJDB.prototype.isOpen = function() {
    return this._impl.isOpen();
};

/**
 * Automatically creates new collection if it does't exists.
 * Collection options `copts`
 * are applied only for newly created collection.
 * For existing collections `copts` takes no effect.
 *
 * Collection options (copts):
 *  {
 *      "cachedrecords" : Max number of cached records in shared memory segment. Default: 0
 *      "records" : Estimated number of records in this collection. Default: 65535.
 *      "large" : Specifies that the size of the database can be larger than 2GB. Default: false
 *      "compressed" : If true collection records will be compressed with DEFLATE compression. Default: false.
 *  }
 *
 * Depending on if cb parameter is passed this function is either async or
 * blocking.
 *
 * @param {String} cname Name of collection.
 * @param {Object} [copts] Collection options.
 * @param {Function} [cb] Callback called with error argument.
 * @return {*}
 */
EJDB.prototype.ensureCollection = function(cname, copts, cb) {
    if (arguments.length === 2 && typeof copts === 'function') {
        cb = copts;
        copts = {};
    }
    return this._impl.ensureCollection(cname, copts || {}, cb);
};


/**
 * Please use #dropCollection
 * @deprecated Will be removed in v1.1 //todo
 */
EJDB.prototype.removeCollection = function(cname, prune, cb) {
    this.dropCollection.apply(this, arguments);
};

/**
 *  Drop collection.
 *
 *  Call variations:
 *      - dropCollection(cname)
 *      - dropCollection(cname, cb)
 *      - dropCollection(cname, prune, cb)
 *
 * @param {String} cname Name of collection.
 * @param {Boolean} [prune=false] If true the collection data will erased from disk.
 * @param {Function} [cb] Callback function with arguments: (error)
 */
EJDB.prototype.dropCollection = function(cname, prune, cb) {
    if (arguments.length == 2) {
        cb = prune;
        prune = false;
    }
    if (!cb) {
        cb = function() {
        };
    }
    //noinspection JSDeprecatedSymbols
    return this._impl.removeCollection(cname, !!prune, cb);
};

/**
 * Save/update specified JSON objects in the collection.
 * If collection with `cname` does not exists it will be created.
 *
 * Each persistent object has unique identifier (OID) placed in the `_id` property.
 * If a saved object does not have `_id` it will be autogenerated.
 * To identify and update object it should contains `_id` property.
 *
 * If callback is not provided this function will be synchronous.
 *
 * Call variations:
 *      - save(cname, <json object>|<Array of json objects>, options)
 *      - save(cname, <json object>|<Array of json objects>, cb)
 *      - save(cname, <json object>|<Array of json objects>, options, cb)
 *
 * NOTE: Field names of passed JSON objects may not contain `$` and `.` characters,
 *       error condition will be fired in this case.
 *
 * @param {String} cname Name of collection.
 * @param {Array|Object} jsarr Signle JSON object or array of JSON objects to save
 * @param {Object?} opts Optional options obj.
 *                  If opts.merge == true saved object will be merged with who's
 *                  already persisted in db.
 * @param {Function} [cb] Callback function with arguments: (error, {Array} of OIDs for saved objects)
 * @return {Array} of OIDs of saved objects in synchronous mode otherwise returns {undefined}.
 */
EJDB.prototype.save = function(cname, jsarr, opts, cb) {
    if (!jsarr) {
        return [];
    }
    if (!Array.isArray(jsarr)) {
        jsarr = [jsarr];
    }
    if (typeof opts == "function") {
        cb = opts;
        opts = null;
    }
    var postprocess = function(oids) {
        //Assign _id property for newly created objects
        for (var i = jsarr.length - 1; i >= 0; --i) {
            var so = jsarr[i];
            if (so != null && so["_id"] !== oids[i]) {
                so["_id"] = oids[i];
            }
        }
    };
    if (cb == null) {
        postprocess(this._impl.save(cname, jsarr, (opts || {})));
        return jsarr;
    } else {
        return this._impl.save(cname, jsarr, (opts || {}), function(err, oids) {
            if (err) {
                cb(err);
                return;
            }
            postprocess(oids);
            cb(null, oids);
        });
    }
};


/**
 * Loads JSON object identified by OID from the collection.
 * If callback is not provided this function will be synchronous.
 *
 * @param {String} cname Name of collection
 * @param {String} oid Object identifier (OID)
 * @param {Function} [cb]  Callback function with arguments: (error, obj)
 *        `obj`:  Retrieved JSON object or NULL if it is not found.
 * @return JSON object or {null} if it is not found in synchronous mode otherwise return {undefined}.
 */
EJDB.prototype.load = function(cname, oid, cb) {
    return this._impl.load(cname, oid, cb);
};

/**
 * Removes JSON object from the collection.
 * If callback is not provided this function will be synchronous.
 *
 * @param {String} cname Name of collection
 * @param {String} oid Object identifier (OID)
 * @param {Function} [cb]  Callback function with arguments: (error)
 * @return {undefined}
 */
EJDB.prototype.remove = function(cname, oid, cb) {
    return this._impl.remove(cname, oid, cb);
};


/*
 * - (cname, [cb])
 * - (cname, qobj, [cb])
 * - (cname, qobj, hints, [cb])
 * - (cname, qobj, qobjarr, [cb])
 * - (cname, qobj, qobjarr, hints, [cb])
 */
function parseQueryArgs(args) {
    var cname, qobj, orarr, hints, cb;
    var i = 0;
    cname = args[i++];
    if (typeof cname !== "string") {
        throw new Error("Collection name 'cname' argument must be specified");
    }
    var next = args[i++];
    if (typeof next === "function") {
        cb = next;
    } else {
        qobj = next;
    }
    next = args[i++];
    if (next !== undefined) {
        if (Array.isArray(next)) {
            orarr = next;
            next = args[i++];
        } else if (typeof next === "object") {
            hints = next;
            orarr = null;
            next = args[i++];
        }
        if (!hints && typeof next === "object") {
            hints = next;
            next = args[i++];
        }
        if (typeof next === "function") {
            cb = next;
        }
    }
    return [cname, (qobj || {}), (orarr || []), (hints || {}), (cb || null)];
}

/**
 * Execute query on collection.
 *
 * EJDB queries inspired by MongoDB (mongodb.org) and follows same philosophy.
 *
 *  - Supported queries:
 *      - Simple matching of String OR Number OR Array value:
 *          -   {'fpath' : 'val', ...}
 *      - $not Negate operation.
 *          -   {'fpath' : {'$not' : val}} //Field not equal to val
 *          -   {'fpath' : {'$not' : {'$begin' : prefix}}} //Field not begins with val
 *      - $begin String starts with prefix
 *          -   {'fpath' : {'$begin' : prefix}}
 *      - $gt, $gte (>, >=) and $lt, $lte for number types:
 *          -   {'fpath' : {'$gt' : number}, ...}
 *      - $bt Between for number types:
 *          -   {'fpath' : {'$bt' : [num1, num2]}}
 *      - $in String OR Number OR Array val matches to value in specified array:
 *          -   {'fpath' : {'$in' : [val1, val2, val3]}}
 *      - $nin - Not IN
 *      - $strand String tokens OR String array val matches all tokens in specified array:
 *          -   {'fpath' : {'$strand' : [val1, val2, val3]}}
 *      - $stror String tokens OR String array val matches any token in specified array:
 *          -   {'fpath' : {'$stror' : [val1, val2, val3]}}
 *      - $exists Field existence matching:
 *          -   {'fpath' : {'$exists' : true|false}}
 *      - $icase Case insensitive string matching:
 *          -    {'fpath' : {'$icase' : 'val1'}} //icase matching
 *          icase matching with '$in' operation:
 *          -    {'name' : {'$icase' : {'$in' : ['tHéâtre - театр', 'heLLo WorlD']}}}
 *          For case insensitive matching you can create special type of string index.
 *      - $elemMatch The $elemMatch operator matches more than one component within an array element.
 *          -    { array: { $elemMatch: { value1 : 1, value2 : { $gt: 1 } } } }
 *          Restriction: only one $elemMatch allowed in context of one array field.
 *      - $and, $or joining:
 *          -   {..., $and : [subq1, subq2, ...] }
 *          -   {..., $or  : [subq1, subq2, ...] }
 *          Example: {z : 33, $and : [ {$or : [{a : 1}, {b : 2}]}, {$or : [{c : 5}, {d : 7}]} ] }
 *
 *      - Mongodb $(projection) operator supported. (http://docs.mongodb.org/manual/reference/projection/positional/#proj._S_)
 *		- Mongodb positional $ update operator supported. (http://docs.mongodb.org/manual/reference/operator/positional/)
 *
 *  - Queries can be used to update records:
 *
 *      $set Field set operation.
 *          - {.., '$set' : {'field1' : val1, 'fieldN' : valN}}
 *      $upsert Atomic upsert. If matching records are found it will be '$set' operation,
 *              otherwise new record will be inserted
 *              with fields specified by argment object.
 *          - {.., '$upsert' : {'field1' : val1, 'fieldN' : valN}}
 *      $inc Increment operation. Only number types are supported.
 *          - {.., '$inc' : {'field1' : number, ...,  'field1' : number}
 *      $dropall In-place record removal operation.
 *          - {.., '$dropall' : true}
 *      $addToSet Atomically adds value to the array only if value not in the array already.
 *                  If containing array is missing it will be created.
 *          - {.., '$addToSet' : {'fpath' : val1, 'fpathN' : valN, ...}}
 *      $addToSetAll Batch version if $addToSet
 *          - {.., '$addToSetAll' : {'fpath' : [array of values to add], ...}}
 *      $pull Atomically removes all occurrences of value from field, if field is an array.
 *          - {.., '$pull' : {'fpath' : val1, 'fpathN' : valN, ...}}
 *      $pullAll Batch version of $pull
 *          - {.., '$pullAll' : {'fpath' : [array of values to remove], ...}}
 *
 * - Collection joins supported in the following form:
 *
 *       {..., $do : {fpath : {$join : 'collectionname'}} }
 *       Where 'fpath' value points to object's OIDs from 'collectionname'. Its value
 *       can be OID, string representation of OID or array of this pointers.
 *
 *  NOTE: It is better to execute update queries with `$onlycount=true` hint flag
 *        or use the special `update()` method to avoid unnecessarily data fetching.
 *  NOTE: Negate operations: $not and $nin not using indexes
 *        so they can be slow in comparison to other matching operations.
 *  NOTE: Only one index can be used in search query operation.
 *  NOTE: If callback is not provided this function will be synchronous.
 *
 *  QUERY HINTS (specified by `hints` argument):
 *      - $max Maximum number in the result set
 *      - $skip Number of skipped results in the result set
 *      - $orderby Sorting order of query fields.
 *      - $onlycount true|false If `true` only count of matching records will be returned
 *                              without placing records in result set.
 *      - $fields Set subset of fetched fields.
 *          If field presented in $orderby clause it will be forced to include in resulting records.
 *          Example:
 *          hints:    {
 *                      "$orderby" : { //ORDER BY field1 ASC, field2 DESC
 *                          "field1" : 1,
 *                          "field2" : -1
 *                      },
 *                      "$fields" : { //SELECT ONLY {_id, field1, field2}
 *                          "field1" : 1,
 *                          "field2" : 1
 *                      }
 *                    }
 *
 * To traverse selected records cursor object is used:
 *      - Cursor#next() Move cursor to the next record and returns true if next record exists.
 *      - Cursor#hasNext() Returns true if cursor can be placed to the next record.
 *      - Cursor#field(name) Retrieve value of the specified field of the current JSON object record.
 *      - Cursor#object() Retrieve whole JSON object with all fields.
 *      - Cursor#reset() Reset cursor to its initial state.
 *      - Cursor#length Read-only property: Number of records placed into cursor.
 *      - Cursor#pos Read/Write property: You can set cursor position: 0 <= pos < length
 *      - Cursor#close() Closes cursor and free cursor resources. Cursor cant be used in closed state.
 *
 * Call variations of find():
 *       - find(cname, [cb])
 *       - find(cname, qobj, [cb])
 *       - find(cname, qobj, hints, [cb])
 *       - find(cname, qobj, qobjarr, [cb])
 *       - find(cname, qobj, qobjarr, hnts, [cb])
 *
 * @param {String} cname Name of collection
 * @param {Object} qobj Main JSON query object
 * @param {Array} [orarr] Array of additional OR query objects (joined with OR predicate).
 * @param {Object} [hints] JSON object with query hints.
 * @param {Function} [cb] Callback function with arguments: (error, cursor, count) where:
 *          `cursor`: Cursor object to traverse records
 *          `count`:  Total number of selected records.
 * @return If callback is provided returns {undefined}.
 *         If no callback and $onlycount hint is set returns count {Number}.
 *         If no callback and no $onlycount hint returns cursor {Object}.
 *
 */
EJDB.prototype.find = function() {
    //[cname, qobj, orarr, hints, cb]
    var qa = parseQueryArgs(arguments);
    return this._impl.query(qa[0], [qa[1]].concat(qa[2], qa[3]),
            (qa[3]["$onlycount"] ? ejdblib.JBQRYCOUNT : 0),
            qa[4]);
};

/**
 * Same as #find() but retrieves only first matching JSON object.
 * If callback is not provided this function will be synchronous.
 *
 * Call variations of findOne():
 *       - findOne(cname, [cb])
 *       - findOne(cname, qobj, [cb])
 *       - findOne(cname, qobj, hints, [cb])
 *       - findOne(cname, qobj, qobjarr, [cb])
 *       - findOne(cname, qobj, qobjarr, hints, [cb])
 *
 * @param {String} cname Name of collection
 * @param {Object} qobj Main JSON query object
 * @param {Array} [orarr] Array of additional OR query objects (joined with OR predicate).
 * @param {Object} [hints] JSON object with query hints.
 * @param {Function} [cb] Callback function with arguments: (error, obj) where:
 *          `obj`:  Retrieved JSON object or NULL if it is not found.
 * @return  If callback is provided returns {undefined}.
 *          If no callback is provided returns found {Object} or {null}.
 */

EJDB.prototype.findOne = function() {
    //[cname, qobj, orarr, hints, cb]
    var qa = parseQueryArgs(arguments);
    qa[3]["$max"] = 1;
    var cb = qa[4];
    if (cb) {
        return this._impl.query(qa[0], [qa[1]].concat(qa[2], qa[3]), 0,
                function(err, cursor) {
                    if (err) {
                        cb(err);
                        return;
                    }
                    if (cursor.next()) {
                        try {
                            cb(null, cursor.object());
                        } finally {
                            cursor.close();
                        }
                    } else {
                        cb(null, null);
                    }
                });
    } else {
        var ret = null;
        var cursor = this._impl.query(qa[0], [qa[1]].concat(qa[2], qa[3]), 0, cb);
        if (cursor && typeof cursor === "object") {
            if (cursor.next()) {
                ret = cursor.object();
            }
            cursor.close();
        }
        return ret;
    }
};


/**
 * Execute ejdb database command.
 *
 * Supported commands:
 *
 *
 *  1) Exports database collections data. See ejdbexport() method.
 *
 *    "export" : {
 *          "path" : string,                    //Exports database collections data
 *          "cnames" : [string array]|null,     //List of collection names to export
 *          "mode" : int|null                   //Values: null|`JBJSONEXPORT` See ejdb.h#ejdbexport() method
 *    }
 *
 *    Command response:
 *       {
 *          "log" : string,        //Diagnostic log about executing this command
 *          "error" : string|null, //ejdb error message
 *          "errorCode" : int|0,   //ejdb error code
 *       }
 *
 *  2) Imports previously exported collections data into ejdb.
 *
 *    "import" : {
 *          "path" : string                     //The directory path in which data resides
 *          "cnames" : [string array]|null,     //List of collection names to import
 *          "mode" : int|null                //Values: null|`JBIMPORTUPDATE`|`JBIMPORTREPLACE` See ejdb.h#ejdbimport() method
 *     }
 *
 *     Command response:
 *       {
 *          "log" : string,        //Diagnostic log about executing this command
 *          "error" : string|null, //ejdb error message
 *          "errorCode" : int|0,   //ejdb error code
 *       }
 *
 * If callback is not provided this function will be synchronous.
 *
 * @param {Object} cmd   BSON command spec.
 * @param {Function} [cb] Callback function with arguments: (error, obj) where:
 *          `obj`:  Command response JSON object.
 * @return Command response JSON object if callback is not provided.
 */
EJDB.prototype.command = function(cmd, cb) {
    if (cb) {
        this._impl.command(cmd, function(err, cursor) {
            if (err) {
                cb(err);
                return;
            }
            if (cursor.next()) {
                try {
                    cb(null, cursor.object());
                } finally {
                    cursor.close();
                }
            } else {
                cb(null, null);
            }
        });
    } else {
        var ret = null;
        var cursor = this._impl.command(cmd);
        if (cursor && typeof cursor === "object") {
            if (cursor.next()) {
                ret = cursor.object();
            }
            cursor.close();
        }
        return ret;
    }
};


/**
 * Convenient method to execute update queries.
 * If callback is not provided this function will be synchronous.
 *
 * The following update operations are supported:
 *      $set Field set operation.
 *          - {.., '$set' : {'field1' : val1, 'fieldN' : valN}}
 *      $inc Increment operation. Only number types are supported.
 *          - {.., '$inc' : {'field1' : number, ...,  'field1' : number}
 *      $dropall In-place record removal operation.
 *          - {.., '$dropall' : true}
 *      $addToSet Atomically adds value to the array only if its not in the array already.
 *                  If containing array is missing it will be created.
 *          - {.., '$addToSet' : {'fpath' : val1, 'fpathN' : valN, ...}}
 *      $pull Atomically removes all occurrences of value from field, if field is an array.
 *          - {.., '$pull' : {'fpath' : val1, 'fpathN' : valN, ...}}
 *
 * Call variations of update():
 *    update(cname, qobj, [cb])
 *    update(cname, qobj, hints, [cb])
 *    update(cname, qobj, qobjarr, [cb])
 *    update(cname, qobj, qobjarr, hints, [cb])
 *
 * @param {String} cname Name of collection
 * @param {Object} qobj Main JSON query object
 * @param {Array} [orarr] Array of additional OR query objects (joined with OR predicate).
 * @param {Object} [hints] JSON object with query hints.
 * @param {Function} [cb] Callback function with arguments: (error, count) where:
 *          `count`:  The number of updated records.
 *
 * @return  If callback is provided returns {undefined}.
 *          If no callback is provided returns {Number} of updated objects.
 */
EJDB.prototype.update = function() {
    //[cname, qobj, orarr, hints, cb]
    var qa = parseQueryArgs(arguments);
    var cb = qa[4];
    if (cb) {
        return this._impl.query(qa[0], [qa[1]].concat(qa[2], qa[3]), ejdblib.JBQRYCOUNT,
                function(err, cursor, count, log) {
                    if (err) {
                        cb(err, null, log);
                        return;
                    }
                    cb(null, count, log);
                });
    } else {
        return this._impl.query(qa[0], [qa[1]].concat(qa[2], qa[3]), ejdblib.JBQRYCOUNT, cb);
    }
};

/**
 * Convenient count(*) operation.
 *
 * Call variations of count():
 *       - count(cname, [cb])
 *       - count(cname, qobj, [cb])
 *       - count(cname, qobj, hints, [cb])
 *       - count(cname, qobj, qobjarr, [cb])
 *       - count(cname, qobj, qobjarr, hints, [cb])
 *
 * @param {String} cname Name of collection
 * @param {Object} qobj Main JSON query object
 * @param {Array} [orarr] Array of additional OR query objects (joined with OR predicate).
 * @param {Object} [hints] JSON object with query hints.
 * @param {Function} [cb] Callback function with arguments: (error, count) where:
 *          `count`:  Number of matching records.
 *
 * @return  If callback is provided returns {undefined}.
 *          If no callback is provided returns {Number} of matched object.
 */
EJDB.prototype.count = function() {
    //[cname, qobj, orarr, hints, cb]
    var qa = parseQueryArgs(arguments);
    var cb = qa[4];
    if (cb) {
        return this._impl.query(qa[0], [qa[1]].concat(qa[2], qa[3]), ejdblib.JBQRYCOUNT,
                function(err, cursor, count, log) {
                    if (err) {
                        cb(err, null, log);
                        return;
                    }
                    cb(null, count, log);
                });
    } else {
        return this._impl.query(qa[0], [qa[1]].concat(qa[2], qa[3]), ejdblib.JBQRYCOUNT, cb);
    }
};

/**
 * Synchronize entire EJDB database and
 * all its collections with storage.
 * If callback is not provided this function will be synchronous.
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.sync = function(cb) {
    return this._impl.sync(cb);
};

/**
 * DROP indexes of all types for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.dropIndexes = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXDROPALL, cb);
};

/**
 * OPTIMIZE indexes of all types for JSON field path.
 *  Performs B+ tree index file optimization.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.optimizeIndexes = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXOP, cb);
};

/**
 * Ensure index presence of String type for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.ensureStringIndex = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXSTR, cb);
};

/**
 * Rebuild index of String type for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.rebuildStringIndex = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXSTR | ejdblib.JBIDXREBLD, cb);
};

/**
 * Drop index of String type for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.dropStringIndex = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXSTR | ejdblib.JBIDXDROP, cb);
};

/**
 * Ensure case insensitive String index for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.ensureIStringIndex = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXISTR, cb);
};

/**
 * Rebuild case insensitive String index for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.rebuildIStringIndex = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXISTR | ejdblib.JBIDXREBLD, cb);
};

/**
 * Drop case insensitive String index for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.dropIStringIndex = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXISTR | ejdblib.JBIDXDROP, cb);
};

/**
 * Ensure index presence of Number type for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.ensureNumberIndex = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXNUM, cb);
};

/**
 * Rebuild index of Number type for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.rebuildNumberIndex = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXNUM | ejdblib.JBIDXREBLD, cb);
};

/**
 * Drop index of Number type for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.dropNumberIndex = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXNUM | ejdblib.JBIDXDROP, cb);
};

/**
 * Ensure index presence of Array type for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.ensureArrayIndex = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXARR, cb);
};

/**
 * Rebuild index of Array type for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.rebuildArrayIndex = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXARR | ejdblib.JBIDXREBLD, cb);
};

/**
 * Drop index of Array type for JSON field path.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {String} path  JSON field path
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.dropArrayIndex = function(cname, path, cb) {
    return this._impl.setIndex(cname, path, ejdblib.JBIDXARR | ejdblib.JBIDXDROP, cb);
};

/**
 * Get description of EJDB database and its collections.
 */
EJDB.prototype.getDBMeta = function() {
    return this._impl.dbMeta();
};

/**
 * Begin collection transaction.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.beginTransaction = function(cname, cb) {
    return this._impl._txctl(cname, 8/*cmdTxBegin*/, cb);
};

/**
 * Commit collection transaction.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.commitTransaction = function(cname, cb) {
    return this._impl._txctl(cname, 10/*cmdTxCommit*/, cb);
};

/**
 * Abort collection transaction.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {Function} [cb] Optional callback function. Callback args: (error)
 */
EJDB.prototype.rollbackTransaction = function(cname, cb) {
    return this._impl._txctl(cname, 9/*cmdTxAbort*/, cb);
};

/**
 * Get collection transaction status.
 * If callback is not provided this function will be synchronous.
 * @param {String} cname Name of collection
 * @param {Function} [cb] Optional callback function. Callback args: (error, isTxActive)
 * @return If no callback provided it will return {true} if transaction active otherwise {false}
 *         or {undefined} if callback presented.
 */
EJDB.prototype.getTransactionStatus = function(cname, cb) {
    return this._impl._txctl(cname, 11/*cmdTxStatus*/, cb);
};


module.exports = EJDB;

