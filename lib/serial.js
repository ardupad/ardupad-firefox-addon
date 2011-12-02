/* -*- Mode: javascript; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
/*
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is ardupad
 *
 * The Initial Developer of the Original Code is
 * Vasilis Tsiligiannis <b_tsiligiannis@silverton.gr>
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 */

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
const MODEM = {
    TIOCM_DTR: parseInt("0x002"),
    TIOCM_RTS: parseInt("0x004")
};
const IOCTL = {
    TIOCMGET: parseInt("0x5415"),
    TIOCMSET: parseInt("0x5418")
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
const ctypesTermiosStruct = new ctypes.StructType("termios",
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
                                      ctypesTermiosStruct.ptr,
                                      ctypes.unsigned_int);   
const ctypesCfsetispeed = lib.declare("cfsetispeed",
				      ctypes.default_abi,
                                      ctypes.int,
                                      ctypesTermiosStruct.ptr,
                                      ctypes.unsigned_int);
const ctypesTcsetattr = lib.declare("tcsetattr",
                                    ctypes.default_abi,
                                    ctypes.int,
                                    ctypes.int,
                                    ctypes.int,
                                    ctypesTermiosStruct.ptr);
const ctypesTcgetattr = lib.declare("tcgetattr",
                                    ctypes.default_abi,
                                    ctypes.int,
                                    ctypes.int,
                                    ctypesTermiosStruct.ptr);
const ctypesIoctl = lib.declare("ioctl",
				ctypes.default_abi,
				ctypes.int,
				ctypes.int,
				ctypes.int,
				ctypes.int.ptr);
const ctypesBufArray = ctypes.char.array(BUFSIZ);

function open(pathname, speed) {
    let ctypesFd = new ctypes.int;

    ctypesFd = ctypesOpen(pathname, (O_FLAGS.O_RDWR | O_FLAGS.O_NOCTTY | O_FLAGS.O_NONBLOCK));
    // XXX: handle open errors
    let fd = ctypesFd;
    setspeed(fd, speed);
    // XXX: handle set attributes errors

    return fd;
}

function close(fd) {
    let ctypesFd = new ctypes.int;

    ctypesFd.value = fd;
    ctypesClose(ctypesFd);
    // XXX: handle close error
}

function setspeed(fd, speed) {
    let ctypesTermios = new ctypesTermiosStruct;
    let ctypesFd = new ctypes.int;
    let ctypesRc = new ctypes.int;

    ctypesFd.value = fd;
    ctypesRc = ctypesTcgetattr(ctypesFd, ctypesTermios.address());
    let rc = ctypesRc.value;
    // XXX: tcgetattr() handle error
    // XXX: save old termios

    ctypesTermios.c_iflag.value = C_IFLAGS.IGNBRK;
    ctypesTermios.c_oflag.value = 0;
    ctypesTermios.c_lflag.value = 0;
    ctypesTermios.c_cflag.value = (C_CFLAGS.CS8 | C_CFLAGS.CREAD | C_CFLAGS.CLOCAL);
    ctypesTermios.c_cc[C_CCS.VMIN]  = 1;
    ctypesTermios.c_cc[C_CCS.VTIME] = 0;

    ctypesCfsetospeed(ctypesTermios.address(), BAUDS[speed]);
    ctypesCfsetispeed(ctypesTermios.address(), BAUDS[speed]);  

    ctypesRc = ctypesTcsetattr(ctypesFd, TCSETATTR.TCSANOW, ctypesTermios.address());
    rc = ctypesRc.value;
    // XXX: tcsetattr() handle error
    // XXX: restore possibly lost O_NONBLOCK flag
}

function recv(fd) {
    let ctypesBuf = new ctypesBufArray;
    let ctypesFd = new ctypes.int;
    let ctypesNb = new ctypes.ssize_t;

    let string = "";
    ctypesFd.value = fd;
    ctypesNb = ctypesRead(ctypesFd, ctypesBuf.address(), 4096);
    let nb = ctypesNb.value;
    // XXX: handle read errors
    for (let i = 0; i < nb; i++) {
	string = string + String.fromCharCode(ctypesBuf[i]);
    }

    return string;
}

function send(fd, string) {
    let ctypesBuf = new ctypesBufArray;
    let ctypesFd = new ctypes.int;
    let ctypesNb = new ctypes.ssize_t;
    let ctypesLen = new ctypes.size_t;

    ctypesLen.value = string.length;
    ctypesFd.value = fd;
    for (let i = 0; i < string.length; i++) {
	ctypesBuf[i] = string.charCodeAt(i);
    }
    ctypesNb = ctypesWrite(ctypesFd, ctypesBuf.address(), ctypesLen);
    // XXX: handle write errors
}

function dtrrts(fd, on) {
    let ctypesCtl = new ctypes.int;
    let ctypesFd = new ctypes.int;
    let ctypesR = new ctypes.int;

    ctypesFd.value = fd;
    ctypesR = ctypesIoctl(ctypesFd, IOCTL.TIOCMGET, ctypesCtl.address());
    let r = ctypesR.value;
    if (r < 0) {
	// XXX: handle ioctl error
    }

    let ctl = ctypesCtl.value;
    if (on) {
	ctl |= (MODEM.TIOCM_DTR | MODEM.TIOCM_RTS);
    } else {
	ctl &= ~(MODEM.TIOCM_DTR | MODEM.TIOCM_RTS);
    }

    ctypesCtl.value = ctl;
    ctypesR = ctypesIoctl(ctypesFd, IOCTL.TIOCMSET, ctypesCtl.address());
    r = ctypesR.value;
    if (r < 0) {
	// XXX: handle ioctl error
    }

}

exports.Serial = function Serial(options) {
    if (!(this instanceof Serial))
	return new Serial(options);

    this.pathname = options.pathname;
    this.speed = options.speed;
    this.__defineGetter__("status", function () {
	return ((this._fd == -1 ||
                 this._fd === undefined) ? false : true);
    });

    this.open = function () {
        this._fd = open(this.pathname, this.speed);
    };
    this.__defineGetter__("exists", function () {
	// XXX: serial port device read/write access checking
    });
    this.recv = function () {
        if (this.status) {
            return recv(this._fd);
        }
    };
    this.send = function (string) {
        if (this.status) {
            send(this._fd, string);
        }
    };
    this.__defineSetter__("dtrrts", function (on) {
        if (this.status) {
            dtrrts(this._fd);
            this._dtrrts = on;
        }
    });
    this.__defineGetter__("dtrrts", function () {
        return this._dtrrts;
    });
    this.destroy = function () {
        if (this.status) {
            close(this._fd);
        }
    };
    this.unload = this.destroy;

    unload.ensure(this);

    return this;
}
