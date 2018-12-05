

require("..")
.test("sqlite", function(assert, mock) {
	var openDb = require("../../lib/db.js")
	, Transform = require("stream").Transform
	, smallChunks = new Transform({
		transform(chunk, encoding, callback) {
			for (var i = 0, len = chunk.length; i < len; ) {
				this.push(chunk.slice(i, i+=23))
			}
			callback()
		}
	})
	, db = openDb(":memory:", {
		pipe: smallChunks
	})
	, rows = [
		{t: 123, key: "1\n2'3", val: false},
		{t: null, key: "abc", val: true}
	]
	, control = String.fromCharCode(
		 1,  1,  2,  3,  4,  5,  6,  7,  8,  9,
		10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
		20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
		30, 31, 32, 33, 34, 35, 36, 37, 38, 39
	) + " \u2028 \u2029\\"

	//db.run("SELECT 1")
	//db.get("select sqlite_version() as version", [], cb("VERSION"))

	db.run("CREATE TABLE q1 (t INT, key TEXT, val BLOB)", [])
	db.run("insert into q1 values (?, ?, ?)", [123, "1\n2'3", false])
	db.run("insert into q1 values (null, 'abc', x'01')")

	/*
	db.all("SELECT * from q1", [], function(err, _rows) {
		assert.equal(err, null)
		assert.equal(_rows, rows)
	})
	*/

	db.run("update q1 set val=? where key=?", [control, "abc"], function() {
	})

	db.get("SELECT val from q1 where key=?", ["abc"], function(err, row) {
		assert.equal(row.val.length, control.length)
		assert.equal(row.val, control)
	})
	db.run("update q1 set val=? where key=?", ["a\0b", "abc"], function(){
	})
	db.get("SELECT val from q1 where key=?", ["abc"], function(err, row) {
		assert.equal(row.val, "ab")
	})

	db.run("select changes()")



	//db.run("SELECT 1;\n");

	db.close(function(err) {
		assert.equal(err, null)
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

