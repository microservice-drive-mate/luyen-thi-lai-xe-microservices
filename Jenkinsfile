pipeline {
  agent { label 'docker-node20' }

  options {
    ansiColor('xterm')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
    skipDefaultCheckout(true)
    timestamps()
  }

  parameters {
    string(name: 'GHCR_OWNER', defaultValue: 'replace-with-github-owner', description: 'GHCR owner/namespace chứa image của dự án')
  }

  environment {
    APP_NAME = 'luyen-thi-lai-xe'
    REGISTRY = 'ghcr.io'
    GHCR_OWNER = "${params.GHCR_OWNER}"
    DOCKER_BUILDKIT = '1'
    COMPOSE_DOCKER_CLI_BUILD = '1'
    SERVICES = 'identity-service user-service exam-service course-service question-service notification-service analytics-service simulation-service media-service audit-service'
    STAGING_HOST = 'staging.example.com'
    STAGING_USER = 'deploy'
    STAGING_DEPLOY_PATH = '/opt/luyen-thi-lai-xe'
    PRODUCTION_HOST = 'prod.example.com'
    PRODUCTION_USER = 'deploy'
    PRODUCTION_DEPLOY_PATH = '/opt/luyen-thi-lai-xe'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Prepare') {
      steps {
        script {
          env.GIT_SHA_SHORT = sh(
            script: 'git rev-parse --short=12 HEAD',
            returnStdout: true,
          ).trim()
          env.IMAGE_TAG = env.TAG_NAME?.trim() ? env.TAG_NAME.trim() : env.GIT_SHA_SHORT
          currentBuild.displayName = "#${env.BUILD_NUMBER} ${env.IMAGE_TAG}"
        }
      }
    }

    stage('Install') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Lint') {
      steps {
        sh 'npm run lint'
      }
    }

    stage('Typecheck') {
      steps {
        sh 'npm run check-types'
      }
    }

    stage('Unit Tests') {
      steps {
        sh 'npx turbo run test --filter=./apps/*'
      }
    }

    stage('Build Workspace') {
      steps {
        sh 'npm run build'
      }
    }

    stage('Docker Login') {
      when {
        anyOf {
          branch 'main'
          buildingTag()
        }
      }
      steps {
        withCredentials([
          usernamePassword(
            credentialsId: 'ghcr-credentials',
            usernameVariable: 'GHCR_USERNAME',
            passwordVariable: 'GHCR_TOKEN',
          ),
        ]) {
          sh '''
            echo "$GHCR_TOKEN" | docker login "$REGISTRY" -u "$GHCR_USERNAME" --password-stdin
          '''
        }
      }
    }

    stage('Build & Push Images') {
      when {
        anyOf {
          branch 'main'
          buildingTag()
        }
      }
      steps {
        sh '''
          set -eu

          for service in $SERVICES; do
            image="$REGISTRY/$GHCR_OWNER/$APP_NAME-$service:$IMAGE_TAG"
            echo "Building $image"
            docker build -f "apps/$service/Dockerfile" -t "$image" .
            docker push "$image"
          done
        '''
      }
    }

    stage('Deploy Staging') {
      when {
        branch 'main'
      }
      steps {
        script {
          env.DEPLOYMENT_STARTED_AT = new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.TimeZone.getTimeZone('UTC'))
        }
        withCredentials([
          usernamePassword(
            credentialsId: 'ghcr-credentials',
            usernameVariable: 'GHCR_USERNAME',
            passwordVariable: 'GHCR_TOKEN',
          ),
        ]) {
          sshagent(credentials: ['deploy-ssh-key']) {
            sh '''
              DEPLOY_ENV=staging \
              DEPLOY_HOST="$STAGING_HOST" \
              DEPLOY_USER="$STAGING_USER" \
              DEPLOY_PATH="$STAGING_DEPLOY_PATH" \
              GHCR_USERNAME="$GHCR_USERNAME" \
              GHCR_TOKEN="$GHCR_TOKEN" \
              GHCR_OWNER="$GHCR_OWNER" \
              IMAGE_TAG="$IMAGE_TAG" \
              bash ./scripts/deploy-staging.sh
            '''
          }
        }
      }
      post {
        always {
          script {
            withEnv([
              'DEPLOYMENT_SOURCE=jenkins',
              'DEPLOYMENT_PROVIDER=jenkins',
              "DEPLOYMENT_WORKFLOW=${env.JOB_NAME ?: 'Jenkinsfile'}",
              'DEPLOYMENT_ENVIRONMENT=staging',
              'DEPLOYMENT_TYPE=docker-compose',
              'DEPLOYMENT_TARGET=ssh-vm',
              "DEPLOYMENT_IMAGE_TAG=${env.IMAGE_TAG ?: ''}",
              "DEPLOYMENT_GIT_SHA=${env.GIT_COMMIT ?: env.IMAGE_TAG ?: ''}",
              "DEPLOYMENT_STATUS=${currentBuild.currentResult?.toLowerCase() ?: 'unknown'}",
              "DEPLOYMENT_SMOKE_STATUS=${currentBuild.currentResult?.toLowerCase() ?: 'unknown'}",
              "DEPLOYMENT_BRANCH=${env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''}",
            ]) {
              sh 'npm run deployment:record || true'
            }
          }
          archiveArtifacts artifacts: 'reports/deployments/events/*.json', allowEmptyArchive: true
        }
      }
    }

    stage('Deploy Production') {
      when {
        buildingTag()
      }
      steps {
        input message: "Deploy ${env.IMAGE_TAG} to production?"
        script {
          env.DEPLOYMENT_STARTED_AT = new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.TimeZone.getTimeZone('UTC'))
        }
        withCredentials([
          usernamePassword(
            credentialsId: 'ghcr-credentials',
            usernameVariable: 'GHCR_USERNAME',
            passwordVariable: 'GHCR_TOKEN',
          ),
        ]) {
          sshagent(credentials: ['deploy-ssh-key']) {
            sh '''
              DEPLOY_ENV=production \
              DEPLOY_HOST="$PRODUCTION_HOST" \
              DEPLOY_USER="$PRODUCTION_USER" \
              DEPLOY_PATH="$PRODUCTION_DEPLOY_PATH" \
              GHCR_USERNAME="$GHCR_USERNAME" \
              GHCR_TOKEN="$GHCR_TOKEN" \
              GHCR_OWNER="$GHCR_OWNER" \
              IMAGE_TAG="$IMAGE_TAG" \
              bash ./scripts/deploy-prod.sh
            '''
          }
        }
      }
      post {
        always {
          script {
            withEnv([
              'DEPLOYMENT_SOURCE=jenkins',
              'DEPLOYMENT_PROVIDER=jenkins',
              "DEPLOYMENT_WORKFLOW=${env.JOB_NAME ?: 'Jenkinsfile'}",
              'DEPLOYMENT_ENVIRONMENT=production',
              'DEPLOYMENT_TYPE=docker-compose',
              'DEPLOYMENT_TARGET=ssh-vm',
              "DEPLOYMENT_IMAGE_TAG=${env.IMAGE_TAG ?: ''}",
              "DEPLOYMENT_GIT_SHA=${env.GIT_COMMIT ?: env.IMAGE_TAG ?: ''}",
              "DEPLOYMENT_STATUS=${currentBuild.currentResult?.toLowerCase() ?: 'unknown'}",
              "DEPLOYMENT_SMOKE_STATUS=${currentBuild.currentResult?.toLowerCase() ?: 'unknown'}",
              "DEPLOYMENT_BRANCH=${env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''}",
            ]) {
              sh 'npm run deployment:record || true'
            }
          }
          archiveArtifacts artifacts: 'reports/deployments/events/*.json', allowEmptyArchive: true
        }
      }
    }
  }

  post {
    always {
      sh 'docker logout "$REGISTRY" || true'
    }
  }
}
