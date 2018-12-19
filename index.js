

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

function Db(file, _opts) {
	var db = this
	, opts = Object.assign({}, defaults, _opts)
	, _col = 0, _len = 0, _type = 0
	, _row = {}
	, args = [opts.bin, "-header", file || ""]
	, bufs = []

	if (file && file !== ":memory:") {
		opened[db.file = file] = db
	}

	if (opts.nice) args.unshift("nice", "-n", opts.nice)

	db.queue = []
	db.headers = db.pending = false

	db.child = spawn(args.shift(), args, opts)
	;(
		opts.pipe ?
		db.child.stdout.pipe(opts.pipe) :
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
			db.firstRow = row
			i = cut = buf.indexOf(10) + 1
			db.headers = buf.toString("utf8", 1, i - 2).split("','")
		} else if (type === 7 && buf[0] === 39) {
			type = 6
			i = 1
		}

		for (; i < len; ) {
			if (type > 3 && (
				buf[i++] !== 39 ||
				buf[i] === 39 && (type = 6) && ++i ||
				i === len && (type = 7)
			)) continue
			code = buf[i++]
			if (type === 0) {
				if (code === 89) return _done()      // Y
				type = (
					code === 39 ? 5 :            // '
					code === 88 ? 4 :            // X
					code === 78 ? (i+=3, 1) : 2  // NULL : numbers
				)
			} else if (code === 10 || code === 44) {     // \n || ,
				if (bufs.length > 0) {
					bufs.push(buf.slice(0, i))
					row[db.headers[col]] = read(Buffer.concat(bufs), type, 0, i + _len)
					_len = _type = bufs.length = 0
				} else {
					row[db.headers[col]] = read(buf, type, cut, i)
				}
				if (code === 10) {
					if (db.onRow) db.onRow.call(db, row)
					row = {}
					col = 0
				} else {
					col++
				}
				cut = i
				type = 0
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
	})
	.on("end", _done)

	db.child.stderr.on("data", function(buf) {
		db.error = buf.toString("utf8", 0, buf.length - 1)
	})

	db.run(".mode quote", function(err) {
		if (err) throw Error(err)
	})

	function _done() {
		_row = {}
		_type = _col = 0
		db.headers = db.pending = false
		if (db.onDone) db.onDone.call(db, db.error)
		if (db.queue.length > 0 && db.pending === false) {
			db.each.apply(db, db.queue.shift())
		}
	}
	function read(buf, type, cut, i) {
		return (
			type === 1 ? null :
			type === 2 ? 1 * buf.toString("utf8", cut, i-1) :
			type === 4 && cut + 6 === i ? buf[cut + 3] === 49 :
			type > 5 ? buf.toString("utf8", cut+1, i-2).replace(unescapeRe, "'") :
			buf.toString("utf8", cut+1, i-2)
		)
	}
}

Db.prototype = {
	each: function(query, values, onRow, onDone) {
		var db = this

		if (Array.isArray(values)) {
			query = query.split("?")
			for (var i = 0, len = values.length; i < len; i++) {
				query[i] += (
					typeof values[i] !== "string" ? (
						values[i] === true ? "X'01'" :
						values[i] === false ? "X'00'" :
						values[i] == null ? "null" :
						values[i]
					) :
					"'" + values[i].replace(escapeRe, "''").replace(/\0/g, "") + "'"
				)
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
			db.error = null
			db.onRow = onRow
			db.onDone = onDone
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
			onDone.call(this, err, this.firstRow)
		})
	},
	close: function(onDone) {
		opened[this.file] = null
		this.each(".quit", nop, onDone)
	}
}

