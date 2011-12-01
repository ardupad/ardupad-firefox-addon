"use strict";

Components.utils.import("resource://gre/modules/ctypes.jsm");

const {Cc,Ci,Cr} = require("chrome");
const unload = require("api-utils/unload");

const O_FLAGS = {
    O_RDWR: parseInt("0x000002"),
    O_NOCTTY: parseInt("0x000100"),
    O_NONBLOCK: parseInt("0x000800"),
};
const BAUDS = {
    B1200: parseInt("0x000009"),
    B2400: parseInt("0x00000B"),
    B4800: parseInt("0x00000C"),
    B9600: parseInt("0x00000D"),
    B19200: parseInt("0x00000E"),
    B38400: parseInt("0x00000F"),
    B57600: parseInt("0x001001"),
    B115200: parseInt("0x001002"),
    B230400: parseInt("0x001003")
};
const C_IFLAGS = {
    IGNBRK: parseInt("0x000001")
};
const C_CFLAGS = {
    CS8: parseInt("0x000030"),
    CREAD: parseInt("0x000080"),
    CLOCAL: parseInt("0x000800")
};
const C_CCS = {
    VTIME: 5,
    VMIN: 6
};
const TCSETATTR = {
    TCSANOW: 0
};
const INTERVAL = 100;
const BUFSIZ = 4096;
const lib = ctypes.open("libc.so.6");
const ctypesOpen = lib.declare("open",
                               ctypes.default_abi,
                               ctypes.int,
                               ctypes.char.ptr,
                               ctypes.int);
const ctypesClose = lib.declare("close",
                                ctypes.default_abi,
                                ctypes.int,
                                ctypes.int);
const ctypesRead = lib.declare("read",
			       ctypes.default_abi,
			       ctypes.ssize_t,
                               ctypes.int,
                               ctypes.voidptr_t,
                               ctypes.size_t);
const ctypesWrite = lib.declare("write",
                                ctypes.default_abi,
                                ctypes.ssize_t,
                                ctypes.int,
                                ctypes.voidptr_t,
                                ctypes.size_t);
const ctypesTermios = new ctypes.StructType("termios",
                                            [{c_iflag   : ctypes.unsigned_int},
                                             {c_oflag   : ctypes.unsigned_int},
                                             {c_cflag   : ctypes.unsigned_int},
                                             {c_lflag   : ctypes.unsigned_int},
                                             {c_line    : ctypes.unsigned_char},
                                             {c_cc      : ctypes.unsigned_char.array(32)}]);
// XXX: support termios2
const ctypesCfsetospeed = lib.declare("cfsetospeed",
                                      ctypes.default_abi,
                                      ctypes.int,
                                      ctypesTermios.ptr,
                                      ctypes.unsigned_int);   
const ctypesCfsetispeed = lib.declare("cfsetispeed",
				      ctypes.default_abi,
                                      ctypes.int,
                                      ctypesTermios.ptr,
                                      ctypes.unsigned_int);
const ctypesTcsetattr = lib.declare("tcsetattr",
                                    ctypes.default_abi,
                                    ctypes.int,
                                    ctypes.int,
                                    ctypes.int,
                                    ctypesTermios.ptr);
const ctypesTcgetattr = lib.declare("tcgetattr",
                                    ctypes.default_abi,
                                    ctypes.int,
                                    ctypes.int,
                                    ctypesTermios.ptr);
const ctypesBuf = ctypes.char.array(BUFSIZ);

function open (pathname, speed) {
    let fd = ctypesOpen(pathname, (O_FLAGS.O_RDWR | O_FLAGS.O_NOCTTY | O_FLAGS.O_NONBLOCK));
    // XXX: handle open errors
    setspeed(fd, speed);
    // XXX: handle set attributes errors
    return fd;
}

function close () {
    ctypesClose(this._fd);
    // XXX: handle close error
}

function setspeed (fd, speed) {
    let termios = new ctypesTermios;
    let rc = ctypesTcgetattr(fd, termios.address());
    // XXX: tcgetattr() handle error
    // XXX: save old termios

    termios.c_iflag = C_IFLAGS.IGNBRK;
    termios.c_oflag = 0;
    termios.c_lflag = 0;
    termios.c_cflag = (C_CFLAGS.CS8 | C_CFLAGS.CREAD | C_CFLAGS.CLOCAL);
    termios.c_cc[C_CCS.VMIN]  = 1;
    termios.c_cc[C_CCS.VTIME] = 0;

    ctypesCfsetospeed(termios.address(), BAUDS[speed]);
    ctypesCfsetispeed(termios.address(), BAUDS[speed]);  

    let rc = ctypesTcsetattr(fd, TCSETATTR.TCSANOW, termios.address());
    // XXX: tcsetattr() handle error
    // XXX: restore possibly lost O_NONBLOCK flag
}

function recv () {
    let buf = new ctypesBuf;
    let string = "";
    let nBytes = ctypesRead(this._fd, buf.address(), 4096);
    // XXX: handle read errors
    for (let i = 0; i < nBytes; i++) {
	string = string + String.fromCharCode(buf[i]);
    }
    return string;
}

function send (string) {
    let buf = new ctypesBuf;
    let length = string.length;

    for (let i = 0; i < length; i++) {
	buf[i] = string.charCodeAt(i);
    }
    let nBytes = ctypesWrite(this._fd, buf.address(), length);
    // XXX: handle write errors
}

exports.Serial = function Serial(options) {
    if (!(this instanceof Serial))
	return new Serial(options);

    this.pathname = options.pathname;
    this.speed = options.speed;
    this.__defineGetter__("open", function () {
	return (this._fd == -1 ? false : true);
    });
    this.__defineGetter__("exists", function () {
	// XXX: serial port device read/write access checking
    });
    this.recv = recv;
    this.send = send;
    this._fd = open(this.pathname, this.speed);
    this.unload = close;
    this.destroy = close;

    unload.ensure(this);

    return Object.freeze(this);
}




