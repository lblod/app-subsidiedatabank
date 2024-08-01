(define-resource organization ()
  :class (s-prefix "org:Organization")
  :properties `((:naam :string ,(s-prefix "skos:prefLabel"))
                (:alternatieve-naam :string-set ,(s-prefix "skos:altLabel"))
                (:wil-mail-ontvangen :boolean ,(s-prefix "ext:wilMailOntvangen")) ;;Voorkeur in berichtencentrum
                (:mail-adres :string ,(s-prefix "ext:mailAdresVoorNotificaties"))
                (:is-trial-user :boolean ,(s-prefix "ext:isTrailUser"))
                (:view-only-modules :string-set ,(s-prefix "ext:viewOnlyModules")))
  :has-one `(
            (organization-classification-code :via ,(s-prefix "org:classification")
                              :as "classificatie"))
  :has-many `(
              (identifier :via ,(s-prefix "adms:identifier")
                              :as "identifiers")
              (participation :via ,(s-prefix "m8g:playsRole")
                              :as "participations"))

  :resource-base (s-url "http://data.lblod.info/id/organisaties/")
  :features '(include-uri)
  :on-path "organizations"
)

(define-resource organization-classification-code ()
  :class (s-prefix "ext:OrganizationClassificationCode")
  :properties `((:label :string ,(s-prefix "skos:prefLabel")))
  :resource-base (s-url "http://data.vlaanderen.be/id/concept/OrganizationClassificationCode/")
  :features '(include-uri)
  :on-path "organization-classification-codes"
)

(define-resource identifier ()
  :class (s-prefix "adms:Identifier")
  :properties `((:id-name :string ,(s-prefix "skos:notation")))
  :resource-base (s-url "http://data.lblod.info/id/identificatoren/")
  :features '(include-uri)
  :on-path "identifiers"
)

;; re-shuffle declaration of files, because
;; mu-resource 1.21.0 is sensible when files
;; are declared vs loaded the class hierarchy
;; hence this is a temporary workaround
;; ORDER REALLY MATTERS FOR NOW!

;;"RESHUFFLED" from slave-besluit.lisp
(define-resource bestuurseenheid (organization) ;; Subclass of m8g:PublicOrganisation, which is a subclass of dct:Agent
  :class (s-prefix "besluit:Bestuurseenheid")

  :has-one `((werkingsgebied :via ,(s-prefix "besluit:werkingsgebied")
                             :as "werkingsgebied")
             (werkingsgebied :via ,(s-prefix "ext:inProvincie")
                             :as "provincie")
             (bestuurseenheid-classificatie-code :via ,(s-prefix "besluit:classificatie")
                                                 :as "classificatie"))

  :has-many `(
              (bestuursorgaan :via ,(s-prefix "besluit:bestuurt")
                              :inverse t
                              :as "bestuursorganen"))

  :resource-base (s-url "http://data.lblod.info/id/bestuurseenheden/")
  :features '(include-uri)
  :on-path "bestuurseenheden"
)

