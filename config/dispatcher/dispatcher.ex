defmodule Dispatcher do
  use Matcher

  define_accept_types [
    json: [ "application/json", "application/vnd.api+json" ],
    html: [ "text/html", "application/xhtml+html" ],
    sparql: [ "application/sparql-results+json" ],
    any: [ "*/*" ]
  ]

  define_layers [ :static, :sparql, :api_services, :frontend_fallback, :resources, :not_found ]

  options "/*path", _ do
    conn
    |> Plug.Conn.put_resp_header( "access-control-allow-headers", "content-type,accept" )
    |> Plug.Conn.put_resp_header( "access-control-allow-methods", "*" )
    |> send_resp( 200, "{ \"message\": \"ok\" }" )
  end

  ##############
  # LOGIN
  ##############

  match "/mock/sessions/*path" do
    forward conn, path, "http://mocklogin/sessions/"
  end
  match "/sessions/*path" do
    forward conn, path, "http://login/sessions/"
  end

  ##############
  # FILES
  ##############

  get "/files/:id/download", %{ layer: :api_services, accept: %{ any: true } } do
    forward conn, [], "http://file/files/" <> id <> "/download"
  end

  get "/files/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/files/"
  end

  ##############
  # RESOURCES
  ##############

  match "/gebruikers/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/gebruikers/"
  end
  match "/accounts/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/accounts/"
  end

  match "/subsidy-measure-consumptions/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/subsidy-measure-consumptions/"
  end

  match "/subsidy-measure-consumption-statuses/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/subsidy-measure-consumption-statuses/"
  end

  match "/subsidy-measure-offers/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/subsidy-measure-offers/"
  end

  get "/bestuurseenheden/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/bestuurseenheden/"
  end

  match "/organizations/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://cache/organizations/"
  end

  match "/organization-classification-codes/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://cache/organization-classification-codes/"
  end

  match "/participations/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/participations/"
  end

  match "/subsidy-application-forms/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/subsidy-application-forms/"
  end

  match "/subsidy-measure-offer-series/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/subsidy-measure-offer-series/"
  end

  match "/subsidy-application-flows/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/subsidy-application-flows/"
  end

  match "/subsidy-application-flow-steps/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/subsidy-application-flow-steps/"
  end

  match "/subsidy-procedural-steps/*path", %{ layer: :resources, accept: %{ json: true } } do
    forward conn, path, "http://resource/subsidy-procedural-steps/"
  end

  match "/submission-document-statuses/*path" do
    forward conn, path, "http://resource/submission-document-statuses/"
  end

  #################################################################
  # subsidy-applications: custom API endpoints
  #################################################################

  get "/management-active-form-file/*path", %{ layer: :api_services, accept: %{ json: true } } do
    forward conn, path, "http://subsidy-applications-management/active-form-file/"
  end

  get "/management-application-forms/*path", %{ layer: :api_services, accept: %{ json: true } } do
    forward conn, path, "http://subsidy-applications-management/semantic-forms/"
  end

  get "/flow-management/*path", %{ layer: :api_services, accept: %{ json: true } } do
    forward conn, path, "http://subsidy-application-flow-management/flow/"
  end

  ###############################################################
  # Search Forms
  ###############################################################

  match "/search-query-forms/*path", %{ layer: :api_services } do
    forward conn, path, "http://form-data-management/search-query-forms/"
  end


 #################
  # NOT FOUND
  #################
  match "/*_path", %{ layer: :not_found } do
    send_resp( conn, 404, "Route not found.  See config/dispatcher.ex" )
  end
end
