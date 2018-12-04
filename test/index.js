
const { Transform } = require('stream')
const myTransform = new Transform({
	transform(chunk, encoding, callback) {
		for (var i = 0, len = chunk.length; i < len; ) {
			this.push(chunk.slice(i, i+=23))
		}
		callback()
	}
})

require("..")
.test("sqlite", function(assert, mock) {
	var openDb = require("../../lib/db.js")

	function cb(name) {
		return function(err, val) {
			console.log(err, name, val)
		}
	}

	var db = openDb(":memory:", {
		pipe: myTransform
	})
	, rows = [{t: 123, key: '1\n2\'3', val: false}, { t: null, key: 'Foo Bar', val: true }]

	db.run("SELECT 1")
	db.run("CREATE TABLE q1 (t INT, key TEXT, val BLOB)", [], cb("CREATE"))
	db.run("insert into q1 values (?, ?, ?)", [123, "1\n2'3", false])
	db.run("insert into q1 values (null, 'abc', x'01')")
	db.get("select sqlite_version() as version", [], cb("VERSION"))

	db.each("SELECT * from q1", [], function(row) {
		console.log("ROW %o", row)

	}, cb("EACH"))

	db.run("update q1 set key=? where key=?", ["Foo Bar", "abc"], function(){
		console.log("UP", arguments)
	})
	db.run("select changes()")

	db.all("SELECT * from q1", [], function(err, _rows) {
		assert.equal(err, null)
		assert.equal(_rows, rows)
	})


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

