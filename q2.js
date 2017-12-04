var http = require('http');
var url  = require('url');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
//var mongourl = 'mongodb://localhost:27017/test';

var server = http.createServer(function (req,res) {
    console.log("INCOMING REQUEST: " + req.method + " " + req.url);

    var parsedURL = url.parse(req.url,true); //true to get query as object
    var queryAsObject = parsedURL.query;

    switch(parsedURL.pathname) {
        case '/read':
            var max = (queryAsObject.max) ? Number(queryAsObject.max) : 20;
            console.log('/read max = ' + max);
            read_n_print(res,{},max);
            break;
        case '/searchbyid':
        case '/search':
            var criteria = {};
            for (key in queryAsObject) {
                criteria[key] = queryAsObject[key];
            }
            console.log('/search criteria = '+JSON.stringify(criteria));
            read_n_print(res,criteria,0);
            break;
        case '/create':
            console.log('/Create qsp = ' + JSON.stringify(queryAsObject));
            create(res,queryAsObject);
            break;
        case '/delete':
            var criteria = {};
            for (key in queryAsObject) {
                criteria[key] = queryAsObject[key];
            }
            console.log('/delete criteria = '+JSON.stringify(criteria));
            remove(res,criteria);
            break;
        case '/borough':
            searchbyborough(res);
            break;
        case "/display":
            console.log('/display '+ queryAsObject._id);
            displayRestaurant(res,queryAsObject._id);
            break;
        case "/edit":
            console.log('/edit ' + JSON.stringify(queryAsObject));
            sendEditForm(res,queryAsObject);
            break;
        case '/update':
            console.log('/update ' + JSON.stringify(queryAsObject));
            update(res,queryAsObject);
            break;
        default:
            res.writeHead(404, {"Content-Type": "text/plain"});
            res.write("404 Not Found\n");
            res.end();
    }
});

function read_n_print(res,criteria,max) {
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err,null);
        console.log('Connected to MongoDB\n');
        findRestaurants(db,criteria,max,function(restaurants) {
            db.close();
            console.log('Disconnected MongoDB\n');
            if (restaurants.length == 0) {
                res.writeHead(500, {"Content-Type": "text/plain"});
                res.end('Not found!');
            } else {
                res.writeHead(200, {"Content-Type": "text/html"});
                res.write('<html><head><title>Restaurant</title></head>');
                res.write('<body><H1>Restaurants</H1>');
                res.write('<H2>Showing '+restaurants.length+' document(s)</H2>');
                res.write('<ol>');
                for (var i in restaurants) {
                    res.write('<li><a href=/display?_id='+
                        restaurants[i]._id+'>'+restaurants[i].name+
                        '</a></li>');
                }
                res.write('</ol>');
                res.end('</body></html>');
                return(restaurants);
            }
        });
    });
}

function searchbyborough(res) {
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(null, err);
        findDistinctBorough(db, function(boroughs) {
            db.close();
            res.writeHead(200, {"Content-Type": "text/html"});
            res.write("<html><body>");
            res.write("<form action=\"/search\" method=\"get\">");
            res.write("Borough: ");
            res.write("<select name=\"borough\">");
            for (i in boroughs) {
                res.write("<option value=\"" +
                    boroughs[i] + "\">" + boroughs[i] + "</option>");
            }
            res.write("</select>");
            res.write("<input type=\"submit\" value=\"Search\">");
            res.write("</form>");
            res.write("</body></html>");
            res.end();
            /*
            console.log(today.toTimeString() + " " + "CLOSED CONNECTION "
                            + req.connection.remoteAddress);
            */
        });
    });
}

function create(res,queryAsObject) {
    var new_r = {};	// document to be inserted
    if (queryAsObject.id) new_r['id'] = queryAsObject.id;
    if (queryAsObject.name) new_r['name'] = queryAsObject.name;
    if (queryAsObject.borough) new_r['borough'] = queryAsObject.borough;
    if (queryAsObject.cuisine) new_r['cuisine'] = queryAsObject.cuisine;
    if (queryAsObject.building || queryAsObject.street) {
        var address = {};
        if (queryAsObject.building) address['building'] = queryAsObject.building;
        if (queryAsObject.street) address['street'] = queryAsObject.street;
        new_r['address'] = address;
    }

    console.log('About to insert: ' + JSON.stringify(new_r));

    MongoClient.connect(mongourl,function(err,db) {
        assert.equal(err,null);
        console.log('Connected to MongoDB\n');
        insertRestaurant(db,new_r,function(result) {
            db.close();
            console.log(JSON.stringify(result));
            res.writeHead(200, {"Content-Type": "text/plain"});
            res.write(JSON.stringify(new_r));
            res.end("\ninsert was successful!");
        });
    });
}

function remove(res,criteria) {
    console.log('About to delete ' + JSON.stringify(criteria));
    MongoClient.connect(mongourl,function(err,db) {
        assert.equal(err,null);
        console.log('Connected to MongoDB\n');
        deleteRestaurant(db,criteria,function(result) {
            db.close();
            console.log(JSON.stringify(result));
            res.writeHead(200, {"Content-Type": "text/plain"});
            res.end("delete was successful!");
        });
    });
}

function update(res,queryAsObject) {
    console.log('About to update ' + JSON.stringify(queryAsObject));
    MongoClient.connect(mongourl,function(err,db) {
        assert.equal(err,null);
        console.log('Connected to MongoDB\n');
        var criteria = {};
        criteria['_id'] = ObjectId(queryAsObject._id);
        var newValues = {};
        /*
        for (key in queryAsObject) {
            if (key != "_id") {
                newValues[key] = queryAsObject[key];
            }
        }
        */
        var address = {};
        for (key in queryAsObject) {
            if (key == "_id") {
                continue;
            }
            switch(key) {
                case 'building':
                case 'street':
                case 'zipcode':
                    address[key] = queryAsObject[key];
                    break;
                default:
                    newValues[key] = queryAsObject[key];
            }
        }
        if (address.lenght > 0) {
            newValues['address'] = address;
        }
        console.log('Preparing update: ' + JSON.stringify(newValues));
        updateRestaurant(db,criteria,newValues,function(result) {
            db.close();
            res.writeHead(200, {"Content-Type": "text/plain"});
            res.end("update was successful!");
        });
    });
}

function displayRestaurant(res,id) {
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err,null);
        console.log('Connected to MongoDB\n');
        db.collection('restaurants').
        findOne({_id: ObjectId(id)},function(err,doc) {
            assert.equal(err,null);
            db.close();
            console.log('Disconnected from MongoDB\n');
            res.writeHead(200, {"Content-Type": "text/html"});
            res.write('<html><title>'+doc.name+'</title>');
            res.write('<body>');
            res.write("<form id='details' method='GET' action='/edit'>");
            res.write('<input type="hidden" name="_id" value="'+doc._id+'"><br>');
            res.write('Name: <input type="text" name="name" value="'+doc.name+'" readonly><br>');
            res.write('Borough: <input type="text" name="borough" value="'+doc.borough+'" readonly><br>');
            res.write('Cuisine: <input type="text" name="cuisine" value="'+doc.cuisine+'" readonly><br>');
            res.write('Address:<br>')
            res.write('<input type="text" name="building" value="'+doc.address.building+'" readonly>');
            res.write(', ');
            res.write('<input type="text" name="street" value="'+doc.address.street+'" readonly><br>');
            res.write('</form>')
            res.write('<script>');
            res.write('function goBack() {window.history.back();}');
            res.write('</script>');
            res.write('<button type="submit" form="details" value="Edit">Edit</button>');
            res.end('<button onclick="goBack()">Go Back</button>');
        });
    });
}

function sendEditForm(res,queryAsObject) {
    res.writeHead(200, {"Content-Type": "text/html"});
    res.write('<html><title>'+queryAsObject.name+'</title>');
    res.write('<body>');
    res.write("<form id='details' method='GET' action='/update'>");
    res.write('<input type="hidden" name="_id" value="'+queryAsObject._id+'"><br>');
    res.write('Name: <input type="text" name="name" value="'+queryAsObject.name+'" ><br>');
    res.write('Borough: <input type="text" name="borough" value="'+queryAsObject.borough+'" ><br>');
    res.write('Cuisine: <input type="text" name="cuisine" value="'+queryAsObject.cuisine+'" ><br>');
    res.write('Address<br>')
    res.write('Building: <input type="text" name="address.building" value="'+queryAsObject.building+'" ><br>');
    res.write('Street: <input type="text" name="address.street" value="'+queryAsObject.street+'" ><br>');
    res.write('</form>')
    res.write('<script>');
    res.write('function goBack() {window.history.back();}');
    res.write('</script>');
    res.write('<button type="submit" form="details" value="Edit">Update</button>');
    res.end('<button onclick="goBack()">Go Back</button>');
}

function findRestaurants(db,criteria,max,callback) {
    var restaurants = [];
    if (max > 0) {
        cursor = db.collection('restaurants').find(criteria).limit(max);
    } else {
        cursor = db.collection('restaurants').find(criteria);
    }
    cursor.each(function(err, doc) {
        assert.equal(err, null);
        if (doc != null) {
            restaurants.push(doc);
        } else {
            callback(restaurants);
        }
    });
}

function insertRestaurant(db,r,callback) {
    db.collection('restaurants').insertOne(r,function(err,result) {
        assert.equal(err,null);
        console.log("Insert was successful!");
        callback(result);
    });
}

function deleteRestaurant(db,criteria,callback) {
    db.collection('restaurants').deleteMany(criteria,function(err,result) {
        assert.equal(err,null);
        console.log("Delete was successfully");
        callback(result);
    });
}

function updateRestaurant(db,criteria,newValues,callback) {
    db.collection('restaurants').updateOne(
        criteria,{$set: newValues},function(err,result) {
            assert.equal(err,null);
            console.log("update was successfully");
            callback(result);
        });
}

function findDistinctBorough(db,callback) {
    db.collection('restaurants').distinct("borough", function(err,result) {
        console.log(result);
        callback(result);
    });
}

server.listen(process.env.PORT || 8099);