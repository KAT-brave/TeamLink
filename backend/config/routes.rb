Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      get "health", to: "health#show"

      post "auth/signup", to: "registrations#create"
      post "auth/login", to: "sessions#create"
      delete "auth/logout", to: "sessions#destroy"
      get "auth/csrf", to: "csrf#show"

      get "me", to: "me#show"
    end
  end
end
