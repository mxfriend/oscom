# OSC Object Model

This package provides an object model for Javascript / Typescript applications
implementing the OSC protocol. It has primarily been developed for use with
the X32/M32 and X-Air/M-Air series digital mixing consoles by Behringer®/Midas®,
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

## Usage

The object structure is composed of _nodes_. A _node_ is a class which
extends from `Node`. There is a generic `Value` class used to represent
leaf nodes which contain some kind of value (usually a scalar, but you
can get fancy if you want to); when the value changes, the node will
emit an event. Another kind of leaf node is the `Command` node, which
is stateless and just emits events when accessed.

Leaf nodes can be children of _containers_. A container is a class
which extends from `Container`; it defines its children as decorated
and typed properties. A special kind of container is a `Collection`,
which is analogous to an indexed array of nodes.

One slightly unusual aspect of this library is that all methods and
properties are either specified using Symbols, or prefixed with a `$`.
This is needed to distinguish them from child properties of containers.

An example object model representing a smart lightbulb controller
might look like this:

```typescript
import { Container, Collection, Root, Command, StringValue, FloatValue, BooleanValue, Property, osc } from '@mxfriend/oscom';

export class IdentifyLightbulbCommand extends Command {
  $call(duration?: number): void {
    this.$emit('local-call', osc.compose('i?', duration), this);
  }
}

export class Lightbulb extends Container {
  @Property on: BooleanValue;
  @Property intensity: FloatValue;
  @Property location: StringValue;
  @Property identify: IdentifyLightbulbCommand;

  constructor() {
    super(true); // #1
  }
}

export class LightbulbCollection extends Collection<Lightbulb> {
  constructor() {
    super(() => new Lightbulb(), { size: 5, pad: 2 }); // #2
  }
}

export class LightbulbController extends Root {
  @Property lightbulbs: LightbulbCollection;
}
```

This model will understand the following OSC addresses and arguments:

```
/lightbulbs/[01..05] <B> <f> <s>
/lightbulbs/[01..05]/on <B>
/lightbulbs/[01..05]/intensity <f>
/lightbulbs/[01..05]/location <s>
/lightbulbs/[01..05]/identify <i>
```

### OSC calls and queries

The official OSC specification states that an OSC server defines a set of
OSC _methods_ (that is, addresses the server recognises) and leaves the semantics
of calling the methods and returning results on the implementer. This particular
implementation follows the convention used by the Behringer®/Midas® consoles
it was designed to work with, which is that each individual node can be marked
as _callable_, which has well-defined semantics for the existing node types:

 - A `Value` is always callable; it accepts exactly zero or one OSC argument.
   Calling a `Value` without specifying an argument is understood as querying
   its current value; when an argument is provided, it is understood as setting
   a new value.
   - E.g. calling `/lightbulbs/03/location` without any arguments would be
     interpreted as asking the controller for the location of lightbulb #3
     and the controller would respond with e.g. `/lightbulb/03/location "Bedroom"`;
     calling `/lightbulbs/03/location "Kitchen"` would set lightbulb #3's location
     to "Kitchen".
 - A `Command` is always callable; the semantics of its arguments are completely
   implementation-dependent.
   - E.g. the `IdentifyLightbulbCommand` can be called with an optional `duration`
     argument to specify how long the lightbulb should blink.
 - A `Container` can be made callable by passing `true` as the first argument
   to its constructor (this is usually done by calling `super(true)` in derived
   classes' constructors, like shown on the line marked `#1` in the above example).
   A callable container will forward calls to each of its children in the order
   they're defined in, until the first non-`Value` child is encountered (this is
   why the list of addresses above doesn't include an `<i>` at the end of the first
   line - the `identify` property of `Lightbulb` is a `Command`, not a `Value`). If
   a callable container is called with zero arguments, the results of the child calls
   are collected and returned to the caller; thus you can query the entire container.
   When a callable container is called with one or more arguments, each of its
   children will be passed a corresponding argument, until either a non-`Value`
   child is encountered, or there are no more arguments; this way you can set
   all (or part of) a container's child values in one call.
   - E.g. calling `/lightbulbs/02` would cause the controller to respond with
     something like `/lightbulbs/02 false 0.5 "Bathroom"`; calling
     `/lightbulbs/02 true 0.75` would turn the lightbulb on and simultaneously
     set its intensity to 75%. Calling `/lightbulbs` would produce no reaction
     because `LightbulbCollection` is not callable.

### Local vs. Remote

The OSC model itself doesn't, and, in fact, shouldn't contain any complex
behaviour. Its primary purpose is to represent an observable state and
methods one can call on that state. All complex logic should be implemented
in event listeners attached to the appropriate nodes. Typically, the model
will be used to represent a _local copy_ of the state, and it will be possible
to mutate the state from both local code and from remote clients. This is why
most events emitted by the model come in two flavours: local (representing
events resulting from a local action) and remote (representing events resulting
from an incoming OSC call). So e.g. the `Value` class emits either a `local-change`
or a `remote-change` event, as opposed to a single shared `change` event.
This allows for easier separation of logic which reacts to local events from
logic which handles remote events, and, importantly, helps prevent trigger loops.

### Container property definitions

The properties of the `Lightbulb` class are defined using a type declaration
and the `@Property` decorator. Notice they don't have an initializer: the model
is lazy and initializes the properties only when you first access them.

Using the `@Property` decorator is mandatory (unless another, more specific
decorator is used) - since the order of object properties in JavaScript is
undefined, we need the decorator (and the well-defined order in which decorators
are executed) to be able to reliably determine the order of child properties
in callable containers.

Node addresses are derived from the names of properties which contain them.
This makes translation between the OSC addresses and object paths intuitive:
to programmatically toggle the state of a lightbulb, you simply do something
like:

```typescript
controller.lightbulbs.$get(2).on.$set(true);
```

### Existing node types

 - `Node`: abstract class which only defines the bare necessities for the
   node tree to work
 - `Value`: abstract base class for value nodes, currently has several
   implementations included in the package, but you can create your own
   as needed:
   - `StringValue`
   - `IntValue`
   - `FloatValue`
   - `BooleanValue`
   - `ScaledValue` - represents a numeric value which is communicated
     using normalized floats in the range 0.0 - 1.0
   - `EnumValue` - represents an enum which is communicated using integer
     indices
 - `Command`: abstract base class for stateless command nodes
 - `Container`: abstract node which can be a parent to other nodes
 - `Collection`: abstract indexed container
 - `Root`: container class which monitors the node tree and builds up
   an internal lookup table for nodes based on their address

## More to come

This is as far as I got today. I'll expand upon this someday, hopefully..
If you want to get going in the meantime, check out one of the MXFriend
libraries which define object models for the Behringer®/Midas® consoles -
e.g. [`@mxfriend/libmxair`] or [`@mxfriend/libmx32`].


[`@mxfriend/libmxair`]: https://github.com/mxfriend/mxfriend/tree/main/packages/libmxair
[`@mxfriend/libmx32`]: https://github.com/mxfriend/mxfriend/tree/main/packages/libmx32
