phanx-mysql
===========
MySQL database wrapper that provides async/await promises.

* Typescript source code included
* Insert and Update Helper Methods
* Promises included for async/await control-flow
* Idle Connection Auto Closer
* No transpiling required (JS code provided)

### requirements

* ECMAScript 2016 (ES6)
* Node.JS 6.x or later (tested on 6.11)

### install

```
npm install phanx-mysql
```

Copy the config.json file into your project source folder, and update with your database connection information.

## Basic Example

```
const PhanxMysql = require("phanx-mysql");

let config = require("./config.json");
PhanxMysql.config = config;

//optional:
PhanxMysql.setAutoCloseMinutes(1);

async function run() {
    let db = await PhanxMysql.createAndStart();

    let rows = await db.query("select * from test;");

    if (db.error)
        console.error(db.error);

    console.log(rows);

    await db.end();

}
run();
```

## Connections

#### Open connection

```
let db = new PhanxMysql();
await db.start();
```
Or use the static helper method:
```
let db = await PhanxMysql.createAndStart();
```

#### Close connection

This will close the connection and return it to the pool.

```
await db.end();
```

Important: Remember to close your connections when you are done with them.

## Accessing Results

There are many ways of accessing the result sets from your queries.

#### Standard callback:

```
await db.query("select * from test;",null, (err, rows, cbResume) => {

    console.log(rows);

    //optional, to move past await
    cbResume();
});
```

#### Rows returned from Promise:

```
let rows = await db.query("select * from test;");
```

#### Rows from getter:

```
await db.query("select * from test;");

for (let row of db.rows) {
    console.log(row);
}
```

#### Async Looping (non-blocking):

```
await db.query("select * from test;");

await db.asyncForEach((i,row,cbNext)=> {
    console.log(i,row);
    cbNext();
});

//done looping
```

#### Row stepping:

```
await db.query("select * from test;");

while (db.hasRows()) {

    let row = db.row;

    console.log(row);
}
```

Note: You could use this method in a more asynchronous manner.

## Parameters within a Query

The query method's second parameter allows you to pass parameters to your SQL statement as an array of any data-type.


```
await db.query("select * from test where id=? ;", [55]);
```
In this example, the value of 55 will be placed where the question mark is, and will be stripped of all SQL injections.


Even for strings you do not include quotes, such as:
```
await db.query("select * from test where username=? ;", ["Tester"]);
```


For LIKE searches you would include the wildcard characters in the array, such as:
```
await db.query("select * from test where username like ? ;", [username+"%"]);
```
This would look for all records with a username that start with the value that is within the username variable.


You can pass multiple parameters to your query as well, since the parameters is an array, like so:
```
await db.query("select * from test where username=? and registered=? ;", [username,registered]);
```
It is important to note the order in which you place the question marks in your SQL, and the order in which you pass the variables within the array.


#### Best practices with parameters

You should not use question mark parameters for anything other than values that are passed to the database server. In other words,  you should not use a question mark in place of a table name or column name.  While it may function in the mysql module we are wrapping, it is not how parameterized queries work in most other database engines.



## Error Handling

### throwErrors

By default throwErrors is enabled.  This means that you should wrap all your queries with a try/catch block and handle the exceptions this way.

#### Disable Throwing Errors:

```
db.throwErrors = false;
```

If you disable throwing errors you allow yourself to check if there was an error ont he last query by using the error property.

Allowing you to check after every query if there was an error.

```
if (db.error) {
    console.error("Database error: ",db.error);
    return;
}
```


## Helper Methods

#### selectRow

Returns the first row of the array as an Object.

```
let row = await db.selectRow("select * from test where id=? ;", [5]);
```

#### selectArray

Returns the result set as an array of row objects.

```
let array = await db.selectArray("select * from test where banned=0 ;");
```

#### Transaction Methods

Executes the sql statements for transactions.

```
await db.begin();
await db.commit();
await db.rollback();
```

Important: Be sure to use a single connection for the entirety of the transaction and for a single transaction at a time.

#### Row Count

After any query, you may also want to check how many rows were returned before looping.

```
if (db.rowCount > 0) {
    //.. loop

} else {
    console.log("No rows found.");
}
```

## Auto Closer

Enabling auto closer in the dbConfig.json file allows database connections that you leave open to be automatically close after a timeout interval provided in minutes.

By default this is not enabled, however you may want to keep this enabled and watch the console to see if the auto closer picks up on any open connections so you can address it and properly close it when you are done.

## Insert Helper

Optional helper to assist in inserting simple queries into your database.

<b>3 Ways to do the same thing:</b>
Inserts a new row into the "test" table with name provided as "Tester" and the ID left null, so to auto-increment.

<pre>
await db.insert("test", {name:"Tester"}).finalize();
</pre>

<pre>
let insert:PhanxInsert = db.insert("test");
insert.row({name:"Tester"});
await insert.finalize();
</pre>

<pre>
await db.insertAndRun("test", {name:"Tester"});
</pre>

## Update Helper

Optional helper to assist in updating simple queries in your database.

<b>3 Ways to do the same thing:</b>
Updates the record with ID of 1, setting the name to "Tester" in the "test" table.

<pre>
await db.update("test", {id:1}, null, {name:"Tester"}).finalize();
</pre>

<pre>
let update:PhanxUpdate = db.update("test", "id=?", [1]);
update.row({name:"Tester"});
await update.finalize();
</pre>

<pre>
await db.updateAndRun("test", {id:1}, null, {name:"Tester"});
//or
await db.updateAndRun("test", "id=?", [1], {name:"Tester"});
</pre>

## Change Log

<b>0.1.6</b>
* Added a change log to readme

<b>0.1.5</b>
* Improved readme documentation to assist with queries with parameters.

<b>0.1.4</b>
* Query now accepts a single value outside of an array.
* Added printQuery method to assist with debugging queries with parameters.

<b>0.1.3</b>
* Insert and Update methods to help write insert and update queries quickly.


## Module Dependencies

- [mysql](https://github.com/mysqljs/mysql)
- [dictionaryjs](https://github.com/phanxgames/dictionaryjs)