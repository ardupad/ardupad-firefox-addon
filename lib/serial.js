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
const timer = require("timer");
const unload = require("api-utils/unload");

const POLL =  {
    POLLIN: parseInt("0x001"),
    POLLOUT: parseInt("0x004"),
    POLLERR: parseInt("0x008")
};
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
const RECV_TIMEOUT = 5000;
const SEND_TIMEOUT = 500;
const DRAIN_TIMEOUT = 250;
const BUFSIZ = 4096;
const PACKSIZ = 1024;

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
const ctypesPollfdStruct = new ctypes.StructType("pollfd",
                                           [{fd: ctypes.int},
                                            {events: ctypes.short},
                                            {revents: ctypes.short}]);
const ctypesPoll = lib.declare("poll",
                               ctypes.default_abi,
                               ctypes.int,
                               ctypesPollfdStruct.ptr,
                               ctypes.unsigned_long,
                               ctypes.int);
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
const ctypesBufArray = new ctypes.ArrayType(ctypes.char, BUFSIZ);

function open(pathname, speed) {
    let err = new Error("Can't open device " + pathname);
    let fd = ctypesOpen(pathname, (O_FLAGS.O_RDWR | O_FLAGS.O_NOCTTY | O_FLAGS.O_NONBLOCK));
    if (fd == -1) {
        throw err;
    } else {
        try {
            setspeed(fd, speed);
        }
        catch (e) {
            console.exception(e.message);
            throw err;
        }
    }

    return fd;
}

function close(fd) {
    ctypesClose(fd);
}

function setspeed(fd, speed) {
    let ctypesTermios = new ctypesTermiosStruct;

    let rc = ctypesTcgetattr(fd, ctypesTermios.address());
    if (rc == -1) {
        throw new Error("ctypesTcgetattr() failed");
        return;
    }
    // XXX: save old termios

    ctypesTermios.c_iflag.value = C_IFLAGS.IGNBRK;
    ctypesTermios.c_oflag.value = 0;
    ctypesTermios.c_lflag.value = 0;
    ctypesTermios.c_cflag.value = (C_CFLAGS.CS8 | C_CFLAGS.CREAD | C_CFLAGS.CLOCAL);
    ctypesTermios.c_cc[C_CCS.VMIN]  = 1;
    ctypesTermios.c_cc[C_CCS.VTIME] = 0;

    ctypesCfsetospeed(ctypesTermios.address(), BAUDS[speed]);
    ctypesCfsetispeed(ctypesTermios.address(), BAUDS[speed]);  

    rc = ctypesTcsetattr(fd, TCSETATTR.TCSANOW, ctypesTermios.address());
    if (rc == -1) {
        throw new Error("ctypesTcsetattr() failed");
        return;
    }
    // XXX: restore possibly lost O_NONBLOCK flag
}

function recv(fd, buflen) {
    let ctypesPollfdArray = new ctypesPollfdStruct;
    let ctypesBuf = new ctypesBufArray;

    let buf = [];
    let len = 0;
    ctypesPollfdArray.fd = fd;
    ctypesPollfdArray.events = POLL.POLLIN;
    while (len < buflen) {
        let nfds = parseInt(ctypesPoll(ctypesPollfdArray.address(),
                                       1,
                                       RECV_TIMEOUT));
        if (nfds == 0) {
            throw new Error("Programmer is not responding");
            return buf;
        } else if (nfds == -1) {
            throw new Error("ctypesPoll() failed");
            return buf;
        }
        let rc = parseInt(ctypesRead(fd,
                                     ctypesBuf.address(),
                                     (buflen - len > PACKSIZ) ? PACKSIZ : buflen - len));
        if (rc == -1) {
            throw new Error("Read error");
            return buf;
        }
        for (let i = 0; i < rc; i++) {
            buf[len + i] = parseInt(ctypesBuf[i]);
        }
        len += rc;
    }

    return buf;
}

function send(fd, buf) {
    let ctypesPollfdArray = new ctypesPollfdStruct;
    let ctypesBuf = new ctypesBufArray;

    let buflen = buf.length;
    for (let i = 0; i < buflen; i++) {
	ctypesBuf[i] = buf.charCodeAt(i);
    }
    let len = 0;
    ctypesPollfdArray.fd = fd;
    ctypesPollfdArray.events = POLL.POLLOUT;
    while (len < buflen) {
        let nfds = parseInt(ctypesPoll(ctypesPollfdArray.address(),
                                       1,
                                       SEND_TIMEOUT));
        if (nfds == 0) {
            throw new Error("Programmer is not responding");
            return;
        } else if (nfds == -1) {
            throw new Error("ctypesPoll() failed");
            return;
        }
        let rc = parseInt(ctypesWrite(fd,
                                      ctypesBuf.address(),
                                      (buflen - len > PACKSIZ) ? PACKSIZ : buflen - len));
        if (rc == -1) {
            throw new Error("Write error");
            return;
        }
        len += rc;
    }

    return;
}

function drain(fd) {
    let ctypesPollfdArray = new ctypesPollfdStruct;
    let ctypesBuf = new ctypesBufArray;

    while (true) {
        let nfds = parseInt(ctypesPoll(ctypesPollfdArray.address(),
                                       1,
                                       DRAIN_TIMEOUT));
        if (nfds == 0) {
            break;
        }
        else if (nfds == -1) {
            throw new Error("ctypesPoll() failed");
            return;
        }
        let rc = parseInt(ctypesRead(fd,
                                     ctypesBuf.address(),
                                     1));
        if (rc == -1) {
            throw new Error("Drain error");
            return;
        }
    }

    return;
}

function dtrrts(fd, on) {
    let ctypesCtl = new ctypes.int;

    let r = ctypesIoctl(fd, IOCTL.TIOCMGET, ctypesCtl.address());
    if (r == -1) {
        throw new Error("ctypesIoctl() with TIOCMGET failed");
        return false;
    }

    let ctl = ctypesCtl.value;
    if (on) {
	ctl |= (MODEM.TIOCM_DTR | MODEM.TIOCM_RTS);
    } else {
	ctl &= ~(MODEM.TIOCM_DTR | MODEM.TIOCM_RTS);
    }

    ctypesCtl.value = ctl;
    r = ctypesIoctl(fd, IOCTL.TIOCMSET, ctypesCtl.address());
    if (r == -1) {
        throw new Error("ctypesIoctl() with TIOCMSET failed");
        return false;
    }

    return true;
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
    this.recv = function (buflen) {
        if (this.status) {
            return recv(this._fd, buflen);
        }
    };
    this.send = function (string) {
        if (this.status) {
            send(this._fd, string);
        }
    };
    this.drain = function () {
        if (this.status) {
            drain(this._fd);
        }
    };
    this.__defineSetter__("dtrrts", function (on) {
        if (this.status) {
            if (dtrrts(this._fd)) {
                this._dtrrts = on;
            }
        }
    });
    this.__defineGetter__("dtrrts", function () {
        return this._dtrrts;
    });
    this.destroy = function () {
        if (this.status) {
            close(this._fd);
            this._fd = undefined;
        }
    };
    this.unload = this.destroy;

    unload.ensure(this);

    return this;
}
