const URI_BASE = 'http://data.lblod.info/form-data/nodes/';

module.exports = {
  name: 'gender-geweld/aanvraag/missing-types-extractor',
  execute: async (store, graphs, lib, source) => {
    const {$rdf, mu, sudo} = lib;

    const RDF_TYPE = new $rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    const SUBSIDIE = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/');

    const OVERZICHT_ERKENNINGEN = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/overzichtErkenningen/');
    const BEGROTING_DOCUMENT = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/begrotingDocument/');
    const BIJLAGE_DOCUMENT = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/bijlageDocument/');

    const overzichtErkenningen = new $rdf.NamedNode(URI_BASE + mu.uuid());
    const bijlageDocument = new $rdf.NamedNode(URI_BASE + mu.uuid());
    const begrotingDocument = new $rdf.NamedNode(URI_BASE + mu.uuid());

    store.add($rdf.sym(source.uri), SUBSIDIE('overzichtErkenningen'), $rdf.sym(overzichtErkenningen), graphs.additions);
    store.add($rdf.sym(overzichtErkenningen), RDF_TYPE, OVERZICHT_ERKENNINGEN('FormData'), graphs.additions);

    store.add($rdf.sym(source.uri), SUBSIDIE('begrotingDocument'), $rdf.sym(begrotingDocument), graphs.additions);
    store.add($rdf.sym(begrotingDocument), RDF_TYPE, BEGROTING_DOCUMENT('FormData'), graphs.additions);

    store.add($rdf.sym(source.uri), SUBSIDIE('bijlageDocument'), $rdf.sym(bijlageDocument), graphs.additions);
    store.add($rdf.sym(bijlageDocument), RDF_TYPE, BIJLAGE_DOCUMENT('FormData'), graphs.additions);
  }
} 
