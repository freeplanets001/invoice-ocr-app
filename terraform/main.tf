# ==============================================
# 帳票データ化システム - GCPインフラ定義
# ==============================================

terraform {
  required_version = ">= 1.0.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# プロバイダー設定
provider "google" {
  project = var.project_id
  region  = var.region
}

# ----------------------------------------------
# 変数定義
# ----------------------------------------------
variable "project_id" {
  description = "GCPプロジェクトID"
  type        = string
}

variable "region" {
  description = "GCPリージョン"
  type        = string
  default     = "asia-northeast1"
}

variable "gemini_api_key" {
  description = "Gemini API Key"
  type        = string
  sensitive   = true
}

# ----------------------------------------------
# APIの有効化
# ----------------------------------------------
resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "firebase.googleapis.com",
    "identitytoolkit.googleapis.com",
  ])
  project = var.project_id
  service = each.value
  disable_on_destroy = false
}

# ----------------------------------------------
# Artifact Registry（Dockerイメージ保存）
# ----------------------------------------------
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "invoice-app"
  description   = "帳票データ化アプリのDockerイメージ"
  format        = "DOCKER"

  depends_on = [google_project_service.services]
}

# ----------------------------------------------
# Secret Manager（APIキー管理）
# ----------------------------------------------
resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "gemini-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "gemini_api_key_version" {
  secret      = google_secret_manager_secret.gemini_api_key.id
  secret_data = var.gemini_api_key
}

# ----------------------------------------------
# サービスアカウント
# ----------------------------------------------
resource "google_service_account" "cloud_run_sa" {
  account_id   = "invoice-app-sa"
  display_name = "Invoice App Cloud Run Service Account"
}

# Secret Managerアクセス権限
resource "google_secret_manager_secret_iam_member" "secret_access" {
  secret_id = google_secret_manager_secret.gemini_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# ----------------------------------------------
# Cloud Run（バックエンドAPI）
# ----------------------------------------------
resource "google_cloud_run_v2_service" "backend" {
  name     = "invoice-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run_sa.email

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/invoice-app/backend:latest"

      ports {
        container_port = 8080
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  depends_on = [
    google_project_service.services,
    google_artifact_registry_repository.docker_repo,
    google_secret_manager_secret_version.gemini_api_key_version,
  ]
}

# Cloud Run公開設定
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ----------------------------------------------
# Cloud Run（フロントエンド）
# ----------------------------------------------
resource "google_cloud_run_v2_service" "frontend" {
  name     = "invoice-frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/invoice-app/frontend:latest"

      ports {
        container_port = 80
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }
  }

  depends_on = [
    google_project_service.services,
    google_artifact_registry_repository.docker_repo,
  ]
}

# フロントエンド公開設定
resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ----------------------------------------------
# 出力
# ----------------------------------------------
output "backend_url" {
  description = "バックエンドAPIのURL"
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "フロントエンドのURL"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "artifact_registry" {
  description = "Artifact Registry URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/invoice-app"
}
