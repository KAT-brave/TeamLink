Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      get "health", to: "health#show"

      post "auth/signup", to: "registrations#create"
      post "auth/login", to: "sessions#create"
      delete "auth/logout", to: "sessions#destroy"
      get "auth/csrf", to: "csrf#show"

      get "me", to: "me#show"

      # 招待コードによる参加(:id より前に定義)
      post "workspaces/join", to: "workspace_joins#create"

      resources :workspaces, only: %i[index show create update] do
        get "members", to: "workspace_memberships#index"
        delete "members/me", to: "workspace_memberships#leave"
        delete "members/:id", to: "workspace_memberships#destroy"

        get "invite_code", to: "workspace_invite_codes#show"
        post "invite_code", to: "workspace_invite_codes#create"
      end
    end
  end
end
