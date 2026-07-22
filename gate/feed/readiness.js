'use strict';

function readyzResponse(schemaOk, feedWorkersOk) {
  const body = {
    schema_ok: schemaOk === true,
    feed_workers_ok: feedWorkersOk === true,
  };
  return {
    status: body.schema_ok ? 200 : 503,
    body,
  };
}

module.exports = { readyzResponse };
