

var spawn = require("child_process").spawn
, opened = {}
, defaults = {
	bin: "sqlite3",
	detached: true
}
, escapeRe = /'/g
, unescapeRe = /''/g

module.exports = openDb

function openDb(file, opts) {
	return opened[file] || new Db(file, opts)
}

function nop() {}

function Db(file, opts) {
	var db = Object.assign(this, defaults, opts)
	, _col = 0, _len = 0, _type = 0
	, _row = {}
	, args = [db.bin, "-header", file || ""]
	, bufs = []

	if (file && file !== ":memory:") {
		opened[db.file = file] = db
	}

	if (db.nice) args.unshift("nice", "-n", db.nice)

	db.queue = []
	db.headers = db.pending = false

	db.child = spawn(args.shift(), args, db)
	;(
		db.pipe ?
		db.child.stdout.pipe(db.pipe) :
		db.child.stdout
	).on("data", function(buf) {
		var code
		, cut = 0
		, i = 0
		, len = buf.length
		, type = _type
		, col = _col
		, row = _row

		if (db.headers === false) {
			if (buf[0] === 89) {
				// no response, wait stderr before calling callback
				return setImmediate(_done)
			}
			if (buf[0] === 10 && buf.length === 1) return
			i = cut = buf.indexOf(10) + 1
			db.headers = buf.toString("utf8", 1, i - 2).split("','")
		} else if (type === 9) {
			type = 8
			i = 1
			if (buf[0] === 10 || buf[0] === 44) {
				read(buf, i)
			}
		}

		for (; i < len; ) {
			if (type > 6 && (
				buf[i++] !== 39 ||
				buf[i] === 39 && (type = 8) && ++i ||
				i === len && (type = 9)
			)) continue
			code = buf[i++]
			if (type === 0) {
				if (code === 89) return setImmediate(_done) // Y
				type = (
					code === 39 ? 7 :            // '
					code === 88 ? 6 :            // X
					code === 99 ? 3 :            // changes:   1   total_changes: 5
					code === 82 ? 4 :            // Run Time: real 0.001 user 0.000069 sys 0.000079
					code === 78 ? (i+=3, 1) : 2  // NULL : numbers
				)
			} else if (code === 10 || code === 44) {     // \n || ,
				read(buf, i)
			}
		}
		_col = col
		_row = row
		_type = type
		if (cut === len) return
		if (bufs.push(buf) === 1) {
			if (cut > 0) bufs[0] = bufs[0].slice(cut)
			_len = bufs[0].length
		} else {
			_len += len
		}
		function read(buf, i) {
			var j = i
			if (bufs.length > 0) {
				bufs.push(buf.slice(0, j))
				buf = Buffer.concat(bufs, j += _len)
				_len = _type = bufs.length = 0
			}
			if (type === 3) {
				j = buf.toString("utf8", cut, j).split(/[\:\s]+/)
				db.changes = +j[1]
				db.totalChanges = +j[3]
			} else if (type === 4) {
				j = buf.toString("utf8", cut, j).split(/[\:\s]+/)
				db.real = +j[3]
				db.user = +j[5]
				db.sys = +j[7]
			} else {
				row[db.headers[col]] = (
					type === 1 ? null :
					type === 2 ? 1 * buf.toString("utf8", cut, j-1) :
					type === 6 ? (
						cut + 6 === j ? buf[cut + 3] === 49 :
						Buffer.from(buf.toString("utf8", cut+2, j-2), "hex")
					) :
					type > 7 ? buf.toString("utf8", cut+1, j-2).replace(unescapeRe, "'") :
					buf.toString("utf8", cut+1, j-2)
				)
				if (code === 10) {
					if (db.firstRow === null) db.firstRow = row
					if (db.onRow !== null) db.onRow.call(db, row)
					row = {}
					col = 0
				} else {
					col++
				}
			}
			cut = i
			type = 0
		}
	})
	.on("end", _done)

	db.child.stderr.on("data", function(buf) {
		db.error = buf.toString("utf8", 0, buf.length - 1)
	})

	db.run(".mode quote", function(err) {
		if (err) throw Error(err)
	})

	if (db.migration) migrate(db, db.migration)

	function _done() {
		_row = {}
		_type = _col = 0
		db.headers = db.pending = false
		if (db.onDone !== null) db.onDone.call(db, db.error)
		else if (db.error !== null) throw Error(db.error + "\n-- " + db.lastQuery)
		if (db.queue.length > 0 && db.pending === false) {
			db.each.apply(db, db.queue.shift())
		}
	}
}

Db.prototype = {
	// Overwriting Db.prototype will ruin constructor
	constructor: Db,
	_add: function(query, values, onDone, onRow) {
		var db = this
		if (db.pending === true) {
			db.queue.unshift([query, values, onRow, onDone])
		} else {
			db.each(query, values, onRow, onDone)
		}
	},
	_esc: function _esc(value) {
		return typeof value !== "string" ? (
			value === true ? "X'01'" :
			value === false ? "X'00'" :
			value == null || value !== value ? "null" :
			Array.isArray(value) ? value.map(_esc).join(",") :
			Buffer.isBuffer(value) ? "X'" + value.toString("hex") + "'" :
			value
		) :
		"'" + value.replace(escapeRe, "''").replace(/\0/g, "") + "'"
	},
	each: function(query, values, onRow, onDone) {
		var db = this

		if (Array.isArray(values)) {
			query = query.split("?")
			for (var i = values.length; i--; ) {
				query[i] += db._esc(values[i])
			}
			query = query.join("")
		} else if (typeof values === "function") {
			onDone = onRow
			onRow = values
		}
		if (db.pending === true) {
			db.queue.push([query, onRow, onDone])
		} else {
			db.pending = true
			db.changes = 0
			db.real = db.user = db.sys = null
			db.error = db.firstRow = null
			db.onRow = typeof onRow === "function" ? onRow : null
			db.onDone = typeof onDone === "function" ? onDone : null
			db.lastQuery = query
			db.child.stdin.write(
				query.charCodeAt(0) !== 46 && query.charCodeAt(query.length-1) !== 59 ? query + ";\n.print Y\n" :
				query + "\n.print Y\n"
			)
		}
	},
	run: function(query, values, onDone) {
		if (typeof values === "function") {
			onDone = values
			values = null
		}
		return this.each(query, values, nop, onDone)
	},
	all: function(query, values, onDone) {
		if (typeof values === "function") {
			onDone = values
			values = null
		}
		var rows = []
		this.each(query, values, rows.push.bind(rows), function(err) {
			onDone.call(this, err, rows)
		})
	},
	get: function(query, values, onDone) {
		if (typeof values === "function") {
			onDone = values
			values = null
		}
		this.each(query, values, nop, function(err) {
			if (typeof onDone === "function") {
				onDone.call(this, err, this.firstRow)
			}
		})
	},
	insert: function(query, values, onDone) {
		if (values && values.constructor === Object) {
			query += "(" + Object.keys(values) + ")"
			values = Object.values(values)
		}
		if (Array.isArray(values)) {
			query += " VALUES (" + Array(values.length).join("?,") + "?)"
		}
		this.get("INSERT INTO " + query + ";SELECT last_insert_rowid() AS lastId;", values, onDone)
	},
	close: function(onDone) {
		opened[this.file] = null
		this.each(".quit", nop, onDone)
	}
}

function migrate(db, dir) {
	var fs = require("fs")
	, path = require("./path")
	, log = require("./log")("db", true)

	db.get("PRAGMA user_version", function(err, res) {
		if (err) return log.error(err)
		var patch = ""
		, current = res.user_version
		, files = fs.readdirSync(dir).filter(isSql).sort()
		, latest = parseInt(files[files.length - 1], 10)

		log.info("dir:%s current:%i latest:%i", dir, current, latest)

		function saveVersion(err) {
			if (err) throw Error(err)
			db.run("PRAGMA user_version=?", [current], function(err) {
				if (err) throw Error(err)
				log.info("Migrated to", latest)
			})
			db.run("INSERT INTO db_schema_log(ver) VALUES (?)", [current], applyPatch)
		}

		function applyPatch(err) {
			if (err) throw Error(err)
			for (var ver, f, i = 0; f = files[i++]; ) {
				ver = parseInt(f, 10)
				if (ver > current) {
					current = ver
					log.info("Applying migration: %s", f)
					f = fs.readFileSync(path.resolve(dir, f), "utf8").trim().split(/\s*^-- Down$\s*/m)
					db.run(f[0])
					db.run(
						"REPLACE INTO db_schema(ver,up,down) VALUES(?,?,?)",
						[ver, f[0], f[1]],
						saveVersion
					)
				}
			}
		}

		if (latest > current) {
			applyPatch()
		} else if (latest < current) {
			var rows = []
			db.run(
				"SELECT down FROM db_schema WHERE id>? ORDER BY id DESC",
				[current],
				function(err) {
					if (err) throw Error(err)
					var patch = rows.map(r=>r.rollback).join("\n")
					db.run(patch, null, saveVersion)
				},
				rows.push.bind(rows)
			)
		}
	})

	function isSql(name) {
		return name.split(".").pop()==="sql"
	}
}


