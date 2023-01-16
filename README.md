# OSC Object Model

This package provides an object model for Javascript / Typescript applications
implementing the OSC protocol. It has primarily been developed for use with
the X32/M32 and X-Air/M-Air series digital mixing consoles by Behringer/Midas,
but it is mostly generic and intended to stay that way, so that it can be used
for other purposes as well.

The package is written in TypeScript, so type declarations are available out
of the box. The OSC model is defined using TypeScript classes, leveraging
property decorators to provide some neat features. This leads to not only
strongly-typed code, but also pretty good self-contained documentation of
the object model.

## Installation

```shell
npm install --save @mxfriend/oscom
```
