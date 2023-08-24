(define-resource submission-document-status () ;; subclass of skos:Concept
  :class (s-prefix "ext:SubmissionDocumentStatus")
  :properties `((:label :string ,(s-prefix "skos:prefLabel")))
  :resource-base (s-url "http://lblod.data.gift/concepts/")
  :features `(include-uri)
  :on-path "submission-document-statuses")