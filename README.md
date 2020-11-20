[LiteJS]: https://www.litejs.com/
[npm package]: https://npmjs.org/package/@litejs/sqlite3
[GitHub repo]: https://github.com/litejs/@litejs/sqlite3

[size]: https://packagephobia.now.sh/badge?p=@litejs/sqlite3
[size-src]: https://packagephobia.now.sh/result?p=@litejs/sqlite3

Sqlite3 &ndash; [![size][size]][size-src]
=======

Small sqlite3 command wrapper with buffer and boolean support.

```javascript
var sqlite3 = require("@litejs/sqlite3")
, db = sqlite3("./test.db", {
	bin: "/bin/sqlite3",     // Default: sqlite3
	migration: "./db/test/"  // Migration sql files. Default: null
	nice: 1                  // Default: null
})

// update db.real, db.user and db.sys for each query
db.run(".timer on")

// report a number of rows affected by INSERT, DELETE, or UPDATE statement
db.run(".changes on")

db.run("CREATE TABLE t1 (id INT PRIMARY KEY, enabled BLOB, val BLOB)")
db.run("INSERT INTO t1 VALUES (?, ?)", [1, true, "str"])
db.get("SELECT id, val FROM t1 WHERE t=?", [1], function(err, row) {
	// row = { id: 1, val: 'str' }
})
db.close()

// allow the parent to exit without waiting for a child to exit
db.child.unref()

```

## External links

[GitHub repo][] |
[npm package][]


## Licence

Copyright (c) 2013-2020 Lauri Rooden &lt;lauri@rooden.ee&gt;  
[The MIT License](http://lauri.rooden.ee/mit-license.txt)


