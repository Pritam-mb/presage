const { SmartSpectraSDK, ValidationCode, ProcessingStatus, breathingMetrics, cardioMetrics, faceMetrics } = require('@smartspectra/node-sdk/renderer');
const { decodeMetrics } = require('@smartspectra/node-sdk/messages');
window.SpoofSDK = { SmartSpectraSDK, ValidationCode, ProcessingStatus, breathingMetrics, cardioMetrics, faceMetrics, decodeMetrics };
