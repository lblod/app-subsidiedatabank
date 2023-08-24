defmodule Dispatcher do
  use Matcher

  define_accept_types [
    json: [ "application/json", "application/vnd.api+json" ],
    html: [ "text/html", "application/xhtml+html" ],
    sparql: [ "application/sparql-results+json" ],
    any: [ "*/*" ]
  ]

  @any %{ accept: %{ any: true } }
  @turtle %{ accept: %{ turtle: true } }
  @html %{ accept: %{ html: true } }
  @json %{ accept: %{ json: true } }

  define_layers [ :static, :sparql, :api_services, :frontend_fallback, :resources, :not_found ]

  options "/*path", _ do
    conn
    |> Plug.Conn.put_resp_header( "access-control-allow-headers", "content-type,accept" )
    |> Plug.Conn.put_resp_header( "access-control-allow-methods", "*" )
    |> send_resp( 200, "{ \"message\": \"ok\" }" )
  end

  ###############
  # STATIC
  ###############

  # frontend
  match "/index.html", %{ layer: :static } do
    forward conn, [], "http://frontend/index.html"
  end

  get "/assets/*path",  %{ layer: :static } do
    forward conn, path, "http://frontend/assets/"
  end

  get "/@appuniversum/*path", %{ layer: :static } do
    forward conn, path, "http://frontend/@appuniversum/"
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
  # RESOURCES
  ##############

  match "/gebruikers/*path", %{ layer: :resources } do
    forward conn, path, "http://resource/gebruikers/"
  end
  match "/accounts/*path", %{ layer: :resources } do
    forward conn, path, "http://resource/accounts/"
  end

  match "/subsidy-measure-consumptions/*path", %{ layer: :resources } do
    forward conn, path, "http://resource/subsidy-measure-consumptions/"
  end

  match "/subsidy-measure-consumption-statuses/*path", %{ layer: :resources } do
    forward conn, path, "http://resource/subsidy-measure-consumption-statuses/"
  end

  match "/subsidy-measure-offers/*path", %{ layer: :resources } do
    forward conn, path, "http://resource/subsidy-measure-offers/"
  end

  get "/bestuurseenheden/*path", %{ layer: :resources } do
    forward conn, path, "http://resource/bestuurseenheden/"
  end

  match "/participations/*path", %{ layer: :resources } do
    forward conn, path, "http://resource/participations/"
  end

  match "/subsidy-application-forms/*path", %{ layer: :resources } do
    forward conn, path, "http://resource/subsidy-application-forms/"
  end

  match "/subsidy-measure-offer-series/*path", %{ layer: :resources } do
    forward conn, path, "http://resource/subsidy-measure-offer-series/"
  end

  match "/subsidy-application-flows/*path", %{ layer: :resources } do
    forward conn, path, "http://resource/subsidy-application-flows/"
  end

  match "/subsidy-application-flow-steps/*path", %{ layer: :resources } do
    forward conn, path, "http://resource/subsidy-application-flow-steps/"
  end

  match "/subsidy-procedural-steps/*path", %{ layer: :resources } do
    forward conn, path, "http://resource/subsidy-procedural-steps/"
  end

  ###############################################################
  # Searching
  ###############################################################

  get "/search-queries/*path", %{ layer: :api_services } do
    forward conn, path, "http://resource/search-queries/"
  end
  post "/search-queries/*path", %{ layer: :api_services } do
    forward conn, path, "http://resource/search-queries/"
  end
  get "/search-queries/*path", %{ layer: :api_services } do
    forward conn, path, "http://search-query-management/search-queries/"
  end
  put "/search-queries/*path", %{ layer: :api_services } do
    forward conn, path, "http://search-query-management/search-queries/"
  end
  delete "/search-queries/*path", %{ layer: :api_services } do
    forward conn, path, "http://search-query-management/search-queries/"
  end
  match "/search-query-forms/*path", %{ layer: :api_services } do
    forward conn, path, "http://search-query-management/search-query-forms/"
  end


  match "/*_", %{ last_call: true } do
    send_resp( conn, 404, "Route not found.  See config/dispatcher.ex" )
  end
end
