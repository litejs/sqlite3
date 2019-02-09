

require("..")
.test("sqlite", function(assert, mock) {
	var openDb = require("../../lib/db.js")
	, db = openDb(":memory:", {
	})
	, txt = "a','',''',\n"
	db.run("CREATE TABLE q1 (t INT, key TEXT, val BLOB)", [])
	db.run("insert into q1 values (?, ?, ?)", [123, "", txt])
	db.get("SELECT val from q1 where t=?", [123], function(err, row) {
		assert.equal(row.val, txt)
	})
	db.text(".schema q1", function(err, text) {
		assert.equal(err, null)
		assert.equal(text, "CREATE TABLE q1 (t INT, key TEXT, val BLOB);")
	})
	db.close(assert.end)
})
.test("sqlite", function(assert, mock) {
	var openDb = require("../../lib/db.js")
	, Transform = require("stream").Transform
	, step = Math.floor(Math.random() * 25) + 4
	, smallChunks = new Transform({
		transform(chunk, encoding, callback) {
			var i = 0
			, len = chunk.length
			this.push(chunk.slice(i, i+=23))
			for (; i < len; ) {
				this.push(chunk.slice(i, i+=7))
			}
			callback()
		}
	})
	, db = openDb(":memory:", {
		pipe: smallChunks
	})
	, noErr = mock.fn(function(err) {
		assert.equal(err, null)
	})
	, assertGet = mock.fn(function(err, row) {
		assert.equal(err, null)
		assert.equal(row.val.length, control.length)
		assert.equal(row.val, control)
	})
	, assertVersion = mock.fn(function(err, row) {
		assert.equal(row, {user_version: 0})
	})
	, rows = [
		{t: 123, key: "1\n2'3", val: false},
		{t: null, key: "abc", val: true},
		{t: 234, key: "", val: null}
	]
	, control = (String.fromCharCode(
		 1,  2,  3,  4,  5,  6,  7,  8,  9,
		10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
		20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
		30, 31, 32, 33, 34, 35, 36, 37, 38, 39
	 ) + "? \u2028 \u2029\\ ','',''',").repeat(step)

	//db.run("SELECT 1")
	//db.get("select sqlite_version() as version", [], cb("VERSION"))

	db.run(".timer on")
	// changes contains a number of database rows affected by the most recently completed INSERT, DELETE, or UPDATE statement
	db.run(".changes on")
	db.run("CREATE TABLE q1 (t INT PRIMARY KEY, key TEXT, val BLOB)", noErr)
	db.run("insert into q1 values (?, ?, ?)", [123, "1\n2'3", false], noErr)
	db.insert("q1 values (null, 'abc', x'01')", function(err, row) {
		assert.equal(err, null)
		assert.equal(row.lastId, 2)
		assert.equal(db.changes, 1)
		assert.ok(db.real >= 0)
		assert.ok(db.user >= 0)
		assert.ok(db.sys >= 0)
	})

	db.insert("q1", [123, "true", true], function(err) {
		assert.ok(/UNIQUE constraint/.test(err))
		assert.equal(db.changes, 0)
	})
	db.insert("q1", rows[2], noErr)

	db.all("SELECT * from q1", assertAll)
	db.all("SELECT * from q1", [], assertAll)
	db.all("SELECT * from q1", null, assertAll)
	function assertAll(err, _rows) {
		assert.equal(err, null)
		assert.equal(_rows, rows)
	}
	db.all("SELECT * from q1 where key in (?)", [["abc", ""]], function(err, _rows) {
		assert.equal(err, null)
		assert.equal(_rows, [rows[1], rows[2]])
	})

	db.run("update q1 set val=? where key=?", [control, "abc"], noErr)

	db.get("SELECT val from q1 where key='abc'", assertGet)
	db.get("SELECT val from q1 where key='abc'", null, assertGet)
	db.get("SELECT val from q1 where key=?", ["abc"], assertGet)
	db.get("SELECT val from q1 where key=?", ["abcd"], function(err, row) {
		assert.equal(err, null)
		assert.equal(row, null)
	})

	db.run("update q1 set val=? where key=?", [Buffer.from("a\0b"), "abc"], noErr)
	db.get("SELECT val from q1 where key='abc'", function(err, row) {
		assert.equal(err, null)
		assert.equal(row.val, Buffer.from("a\0b"))
	})

	db.get("select changes() as c, total_changes() as t", function(err, row) {
		assert.equal(row.c, db.changes)
		assert.equal(row.t, db.totalChanges)
	})


	db.get("PRAGMA user_version", assertVersion)
	db.get("PRAGMA user_version", [], assertVersion)
	db.get("PRAGMA user_version", null, assertVersion)

	//db.run("SELECT 1;\n");

	db.close(function(err) {
		assert.equal(err, null)
		assert.equal(noErr.called, 5)
		assert.equal(assertGet.called, 3)
		assert.equal(assertVersion.called, 3)
		assert.end()
	})

})


// 2017-01-02 (3.16.0) Added ".mode quote" to the command-line shell.
// 2012-12-12 (3.7.15) Added the ".print" command

/*
net.request("sqlite:data.db/test#journal_mode=memory", {
	method: "GET"
})
*/


//var child = require("child_process")

/*
$
https://github.com/WebReflection/dblite/blob/master/src/dblite.js
https://github.com/hansschmucker/Node-SQLite-NoDep/blob/master/SQLite.js
https://www.sqlite.org/cli.html

.prompt MAIN CONTINUE
// maxLen 19
--0.uiy9w8am6y9 123


.mode quote
.prompt '$- random ---' ''
select sqlite_version();
'3.25.3'


select 'aa' as '---';
aa

*/

