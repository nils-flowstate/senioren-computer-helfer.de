'use strict';
// Logik des Dienstes „ki“ ohne Netz und ohne Claude:
//   docker run --rm -v "$PWD":/app -w /app node:22-alpine node --test
const test = require('node:test'), assert = require('node:assert');
process.env.RATE_LIMIT_PRO_MINUTE = '2';
process.env.MAX_NACHRICHTEN_PRO_SITZUNG = '3';
const { anfrage, aufbereiten, zuViel, MAX_RUNDEN } = require('./server.js');

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');
const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
const bild = (typ, daten) => ({ art: 'bild', typ, daten });

test('Bild mit passender Signatur wird angenommen', () => {
  const a = anfrage({ dateien: [bild('image/jpeg', jpeg)] });
  assert.equal(a.inhalt[0].type, 'image');
  assert.equal(a.inhalt[0].source.media_type, 'image/jpeg');
  assert.equal(a.runde, 1);
});
test('Falscher Inhalt hinter Bild-Typ wird abgelehnt', () => {
  assert.equal(anfrage({ dateien: [bild('image/png', jpeg)] }), null);
  assert.equal(anfrage({ dateien: [bild('image/svg+xml', jpeg)] }), null);
  assert.equal(anfrage({ dateien: [{ art: 'pdf', daten: jpeg }] }), null);
});
test('PDF und Text werden zu Dokumenten', () => {
  const a = anfrage({ dateien: [{ art: 'pdf', daten: pdf }, { art: 'text', daten: 'Fehler 0x80070005' }] });
  assert.deepEqual(a.inhalt.slice(0, 2).map((c) => c.source.media_type), ['application/pdf', 'text/plain']);
});
test('Ohne Datei oder mit zu vielen Dateien', () => {
  assert.equal(anfrage({}), null);
  assert.equal(anfrage({ dateien: [] }), null);
  const a = anfrage({ dateien: Array(5).fill(bild('image/jpeg', jpeg)) });
  assert.equal(a.inhalt.filter((c) => c.type === 'image').length, 3);
});
test('Zu großes Bild wird abgelehnt', () => {
  const gross = Buffer.alloc(11 * 1048576); gross.set([0xff, 0xd8, 0xff]);
  assert.equal(anfrage({ dateien: [bild('image/jpeg', gross.toString('base64'))] }), null);
});
test('Kontext und Antworten landen gekennzeichnet im Text, Steuerzeichen nicht', () => {
  const a = anfrage({ dateien: [bild('image/jpeg', jpeg)], thema: 'drucker', geraet: 'win', kontext: 'Ich wollte\u0007 drucken',
    verlauf: [{ frage: 'Leuchtet ein Licht?', antwort: 'Ja' }], runde: 2 });
  const t = a.inhalt.at(-1).text;
  assert.match(t, /Thema: Der Drucker druckt nicht/);
  assert.match(t, /Gerät: Windows-Computer/);
  assert.match(t, /<dazugeschrieben>\nIch wollte drucken\n<\/dazugeschrieben>/);
  assert.match(t, /Frage: Leuchtet ein Licht\?\nAntwort: Ja/);
  assert.equal(a.runde, 2);
});
test('Unbekanntes Thema oder Gerät wird weggelassen', () => {
  const t = anfrage({ dateien: [bild('image/jpeg', jpeg)], thema: '<script>', geraet: 'x' }).inhalt.at(-1).text;
  assert.doesNotMatch(t, /Thema|Gerät/);
});
test('Letzte Runde verlangt das Ende', () => {
  const t = anfrage({ dateien: [bild('image/jpeg', jpeg)], runde: 99 }).inhalt.at(-1).text;
  assert.match(t, /letzte Runde/);
});

test('Antwort: höchstens drei Fragen, vier Antworten, ohne „weiß nicht“', () => {
  const f = { frage: 'F?', antworten: ['Ja', 'Nein', 'Ich weiß es nicht', 'Vielleicht', 'Oft', 'Selten'] };
  const r = aufbereiten({ nachricht: 'Ich sehe einen Drucker.', warnung: '', fragen: [f, f, f, f], fertig: false, hausbesuch: false, neues_foto: false }, 1);
  assert.equal(r.fragen.length, 3);
  assert.deepEqual(r.fragen[0].antworten, ['Ja', 'Nein', 'Vielleicht', 'Oft']);
  assert.equal(r.fertig, false);
});
test('Antwort: Folgerunden höchstens zwei Fragen, letzte Runde keine', () => {
  const f = { frage: 'F?', antworten: ['Ja', 'Nein'] };
  const roh = { nachricht: 'Schritt', warnung: '', fragen: [f, f, f], fertig: false, hausbesuch: false, neues_foto: false };
  assert.equal(aufbereiten(roh, 2).fragen.length, 2);
  const ende = aufbereiten(roh, MAX_RUNDEN);
  assert.equal(ende.fragen.length, 0);
  assert.equal(ende.fertig, true);
});
test('Antwort: neues Foto nur in der ersten Runde und dann ohne Fragen', () => {
  const roh = { nachricht: 'Zu dunkel.', warnung: '', fragen: [{ frage: 'F?', antworten: ['Ja'] }], fertig: false, hausbesuch: false, neues_foto: true };
  const r1 = aufbereiten(roh, 1);
  assert.equal(r1.neues_foto, true); assert.equal(r1.fragen.length, 0); assert.equal(r1.fertig, false);
  assert.equal(aufbereiten(roh, 2).neues_foto, false);
});
test('Antwort: Fragen ohne Antwortknöpfe fallen weg', () => {
  const r = aufbereiten({ nachricht: 'x', warnung: '', fragen: [{ frage: 'F?', antworten: ['Ich weiß nicht'] }], fertig: false, hausbesuch: false, neues_foto: false }, 1);
  assert.equal(r.fragen.length, 0); assert.equal(r.fertig, true);
});

test('Grenzen: pro Minute je Adresse, pro Sitzung', () => {
  assert.equal(zuViel('1.1.1.1', 'a'), '');
  assert.equal(zuViel('1.1.1.1', 'a'), '');
  assert.equal(zuViel('1.1.1.1', 'a'), 'rate');
  assert.equal(zuViel('2.2.2.2', 'a'), '');
  assert.equal(zuViel('3.3.3.3', 'a'), 'sitzung');
  assert.equal(zuViel('3.3.3.3', 'b'), '');
});
