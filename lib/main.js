const {Cc,Ci,Cr} = require("chrome");
//const timer = require("timer");
const {Serial} = require("serial");


exports.main = function () {

    var serial = Serial({
	pathname: "/dev/ttyS0",
	speed: "B115200"
    });

    console.log(serial.recv());

    serial.send("foobar");
    serial.destroy();
}

