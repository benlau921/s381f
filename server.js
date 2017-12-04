var bodyParser = require('body-parser')
var express = require('express');
var session = require('cookie-session');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var mongourl = 'mongodb://ben:123456@ds119736.mlab.com:19736/s381f';
var fileUpload = require('express-fileupload');

var app = express();


app.set('view engine','ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(fileUpload());

// session control
var SECRETKEY1 = 'benlau';
var SECRETKEY2 = 'benshmcpslau';
app.use(session({
    name: 'session',
    keys: [SECRETKEY1,SECRETKEY2]
}));
// end of session control





// handling login and logout action
app.get('/',function(req,res) {

    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        res.status(200);
        res.redirect('/read');
    }
});

app.get('/login',function(req,res) {
    res.sendFile(__dirname + '/public/login.html');
});

app.post('/login',function(req,res) {
    MongoClient.connect(mongourl,function(err,db){
       assert.equal(null,err);
       findUser(db,req.body.name,function(user){
           db.close();
           if(user!=null){
           if (req.body.name == user.name && req.body.password == user.password) {
                   req.session.authenticated = true;
                   req.session.username = user.name;
               } else {
                   console.log("Wrong password");
               }
           }else{
               console.log("no such user");
           }
           res.redirect('/');
           //console.log("redirect to /");
           //res.redirect('/');
        });
    });
});


app.get('/logout',function(req,res) {
    req.session = null;
    res.redirect('/');
});

//end of login and logout action

//read

app.get('/read',function(req,res) {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        MongoClient.connect(mongourl,function(err,db){
            assert.equal(null,err);
            loadRestaurants(db,function(rests){
                db.close();
                /*
                for(var i = 0; i<rests.length;i++){
                    console.log(rests[i].name);
                }
                */
                res.status(200);
                res.render('read',{name:req.session.username, rests: rests});
            });
        });
    }
});

app.get('/display',function(req,res) {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {

        MongoClient.connect(mongourl,function(err,db){
            assert.equal(null,err);
            displayRestaurants(db,req.query._id,function(restaurant){
                db.close();
                res.status(200);
                res.render('display',{name:req.session.username, restaurant: restaurant});
            });
        });

    }
});


//end of read

//create.
app.get('/new',function(req,res) {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        res.status(200);
        res.render('new',{name:req.session.username});
    }
});

app.post('/create',function(req,res) {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        var new_r = {};
        new_r['name'] = req.body.name;
        if (req.body.cuisine) new_r['cuisine'] = req.body.cuisine;
        if (req.body.borough) new_r['borough'] = req.body.borough;
        var address = {};
        new_r['address'] = address;
        if (req.body.street || req.body.building || req.body.zipcode || req.body.lon || req.body.lat){

            address['street'] = req.body.street;
            address['building'] = req.body.building;
            address['zipcode'] = req.body.zipcode;
            address['lon'] = req.body.lon;
            address['lat'] = req.body.lat;

            new_r['address'] = address;
        }

        if (req.body.grade){
            var grades = [];
            var item = {};
            item['score'] = req.body.grade;
            item['user'] = req.session.username;
            grades.push(item);
            new_r['grades'] = grades;
        }
/*
        console.log("contains photo");
        var photo = req.files.photo;
        new_r('photo') = photo;
        photo.mv('./public/file.jpg');
*/
        new_r['owner'] = req.session.username;
        console.log(new_r);

        MongoClient.connect(mongourl,function(err,db){
            assert.equal(null,err);
            createRestaurant(db,new_r,function(rests){
                db.close();

                res.status(200);
                res.render('createR',{new_r:new_r});
            });
        });
    }
});



// end of create

//update

app.get('/change',function(req,res) {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        MongoClient.connect(mongourl,function(err,db){
            assert.equal(null,err);
            displayRestaurants(db,req.query._id,function(restaurant){
                db.close();
                if (restaurant['owner']!=req.session.username){
                    res.send("You are not the owner! Edit not allowed!");
                } else {
                       res.render('change',{name:req.session.username, restaurant: restaurant});
                }
                res.status(200);
            });
        });
    }
});

app.post('/update',function(req,res) {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        doc = {};
        doc['name'] = req.body.name;
        doc['borough'] = req.body.borough;
        doc['cuisine'] = req.body.cuisine;
        doc['name'] = req.body.name;
        address = {};
        address['street'] = req.body.street;
        address['building'] = req.body.building;
        address['zipcode'] = req.body.zipcode;
        address['lon'] = req.body.lon;
        address['lat'] = req.body.lat;
        doc['address'] = address;

        MongoClient.connect(mongourl,function(err,db){
            assert.equal(null,err);
            updateRestaurant(db,req.query._id,doc,function(restaurant){
                db.close();
                res.status(200);
                res.redirect('/display?_id='+req.query._id);
            });
        });

    }
});


//end of update


//rate
app.get('/rate',function(req,res) {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        console.log(req.query._id)
        res.render('rate',{oid:req.query._id});
    }
});

app.post('/rate',function(req,res) {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        var rate = req.body.score;
        var pushValue = {};
        var grades = [];
        pushValue['user'] = req.session.username;
        pushValue['score'] = rate;
        MongoClient.connect(mongourl,function(err,db){
            assert.equal(null,err);
            displayRestaurants(db,req.query._id,function(restaurant){
                if (restaurant['grades'] != undefined) {
                    grades = restaurant['grades'];
                    for (var i=0;i<grades.length;i++){
                        if (grades[i]['user']==req.session.username){
                            grades[i] = pushValue;
                            break;
                        } else {
                            grades.push(pushValue);
                        }
                    }
                } else {
                    grades.push(pushValue);
                }


                db.collection('restaurants').updateOne({_id: ObjectId(req.query._id)},{$set:{"grades": grades}},function(err,result) {
                    assert.equal(err,null);
                });
                res.redirect('/');
                db.close();
            });
        });
    }
});



//end of rate

//curl create

app.post('/api/restaurant/create',function(req,res) {

        var new_r = {};
        new_r['name'] = req.body.name;
        if (req.body.cuisine) new_r['cuisine'] = req.body.cuisine;
        if (req.body.borough) new_r['borough'] = req.body.borough;
        var address = {};
        new_r['address'] = address;
        if (req.body.street || req.body.building || req.body.zipcode || req.body.lon || req.body.lat){
            address['street'] = req.body.street;
            address['building'] = req.body.building;
            address['zipcode'] = req.body.zipcode;
            address['lon'] = req.body.lon;
            address['lat'] = req.body.lat;
            new_r['address'] = address;
        }

        if (req.body.grade){
            var grades = [];
            var item = {};
            item['score'] = req.body.grade;
            item['user'] = req.body.username;
            grades.push(item);
            new_r['grades'] = grades;
        }
        /*
                console.log("contains photo");
                var photo = req.files.photo;
                new_r('photo') = photo;
                photo.mv('./public/file.jpg');
        */
        new_r['owner'] = req.body.owner;
        console.log(new_r);

        MongoClient.connect(mongourl,function(err,db){
            assert.equal(null,err);
            createRestaurant(db,new_r,function(rests){
                db.close();

                res.status(200);
                res.send(new_r);

            });
        });

});




//end of curl create



//gmap
app.get('/gmap',function(req,res) {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        console.log("OK");
        res.render('gmap',{lat:req.query.lat,lon:req.query.lon});
    }
});

//end of gmap

//delete one document
app.get('/delete',function(req,res) {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        MongoClient.connect(mongourl,function(err,db){
            assert.equal(null,err);
            displayRestaurants(db,req.query._id,function(restaurant){
                if (restaurant['owner']!=req.session.username){
                    res.send("You are not the owner!");
                } else {
                    db.collection('restaurants').deleteOne({_id: ObjectId(req.query._id)},function(err,result){
                        assert.equal(err,null);
                        res.redirect('/');
                    });
                }
                db.close();
                res.status(200);
            });
        });
    }
});
//end of delete one document

//remove all
app.get('/clear',function(req,res) {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        MongoClient.connect(mongourl,function(err,db){
            assert.equal(null,err);
            removeAll(db,function(){
                db.close();
                res.status(200);
                res.send("done");
            });
        });
    }
});

//end of remove all


//api
app.get('/api/restaurant/read/borough/:borough',function(req,res) {
        var borough = {"borough":req.params.borough};
        MongoClient.connect(mongourl,function(err,db){
            assert.equal(null,err);
            loadSomeRestaurants(db,borough,function(rests){
                db.close();
                res.status(200);
                res.send(rests);
            });
        });
});

app.get('/api/restaurant/read/name/:name',function(req,res) {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        var name = {"name":req.params.name};
        MongoClient.connect(mongourl,function(err,db){
            assert.equal(null,err);
            loadSomeRestaurants(db,name,function(rests){
                db.close();
                res.status(200);
                res.send(rests);
            });
        });
    }
});


//end of api


//functions


//function of finding user name
var findUser = function(db,username,callback){
    var cursor = db.collection('users').find({"name": username });


    cursor.each(function(err,doc){
       assert.equal(err,null);
       if (doc!=null){
           console.log(doc);
           user = doc;
           callback(user);
           return false;
        } else {
           callback(null);
       }
    });
};
//end of findUser method




//Load all restaurants
var loadRestaurants = function(db,callback){
    var rests=[];

    var cursor = db.collection('restaurants').find();

    cursor.each(function(err,doc){
        assert.equal(err,null);
        if(doc!=null){
            rests.push(doc);
        } else {
            callback(rests);
        }
    });
};
//end of load all restaurants

//Load some restaurants
var loadSomeRestaurants = function(db,filter,callback){
    var rests=[];

    var cursor = db.collection('restaurants').find(filter);

    cursor.each(function(err,doc){
        assert.equal(err,null);
        if(doc!=null){
            rests.push(doc);
        } else {
            callback(rests);
        }
    });
};
//end of some restaurants




//Create a document
var createRestaurant = function(db,new_r,callback){
    db.collection('restaurants').insertOne(new_r,function(err,result){
        assert.equal(err,null);
        console.log("insert done");
        callback(result);
    });
};
//end of create a document

//display restaurants
var displayRestaurants = function(db,oid,callback){
    var cursor = db.collection('restaurants').find({_id: ObjectId(oid) });

    console.log(oid);
    cursor.each(function(err,doc){
        assert.equal(err,null);
        if (doc!=null){
            console.log(doc);
            callback(doc);
            return false;
        } else {
            console.log("not found");
            callback(null);
        }
    });
};


//end of display restaurants

//update
var updateRestaurant = function(db,oid,doc,callback){
    db.collection('restaurants').updateOne({_id: ObjectId(oid)},{$set:doc},function(err,result){
            assert.equal(err,null);
            console.log("update done");
            callback(result);
        });
};
//end of update

//remove all
var removeAll = function(db,callback){
    db.collection('restaurants').remove({});
    callback();
};
//end of remove all

//end of functions





// Port of the server
app.listen(process.env.PORT || 8099);