"use strict";Object.defineProperty(exports,"__esModule",{value:true});exports.default=connections;var _debug=_interopRequireDefault(require("debug"));var _argv=_interopRequireDefault(require("./argv"));function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}const log=(0,_debug.default)('@sequencemedia/rabbit-mq:args');log('`@sequencemedia/rabbit-mq:args` is awake');function connections(map=_argv.default){return map.has('connections')&&String(map.get('connections'))==='true';}