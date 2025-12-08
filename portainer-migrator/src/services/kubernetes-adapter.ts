/**
 * Kubernetes Adapter - v2.0.0
 * Handles Kubernetes resource discovery and migration
 */

import type {
  KubernetesEndpoint,
  KubernetesResource,
  KubernetesMigrationConfig,
  HelmRelease,
  NamespaceMapping,
  ConfigMapMigration,
  SecretMigration,
  DokployCompose,
} from "../types";

export class KubernetesAdapter {
  private kubeconfig?: string;
  private currentContext?: string;

  /**
   * Connect to a Kubernetes cluster
   */
  async connect(endpoint: KubernetesEndpoint): Promise<boolean> {
    try {
      if (endpoint.Configuration?.KubeConfig) {
        this.kubeconfig = endpoint.Configuration.KubeConfig;
      }
      // Would use @kubernetes/client-node in production
      return true;
    } catch (error) {
      console.error("Failed to connect to Kubernetes:", error);
      return false;
    }
  }

  /**
   * Discover all resources in a namespace
   */
  async discoverResources(
    namespace: string,
    config: KubernetesMigrationConfig
  ): Promise<KubernetesResource[]> {
    const resources: KubernetesResource[] = [];

    if (config.migrateDeployments) {
      const deployments = await this.getDeployments(namespace);
      resources.push(...deployments);
    }

    if (config.migrateServices) {
      const services = await this.getServices(namespace);
      resources.push(...services);
    }

    if (config.migrateConfigMaps) {
      const configMaps = await this.getConfigMaps(namespace);
      resources.push(...configMaps);
    }

    if (config.migrateSecrets) {
      const secrets = await this.getSecrets(namespace);
      resources.push(...secrets);
    }

    if (config.migrateIngresses) {
      const ingresses = await this.getIngresses(namespace);
      resources.push(...ingresses);
    }

    return resources;
  }

  /**
   * Get deployments in a namespace
   */
  async getDeployments(namespace: string): Promise<KubernetesResource[]> {
    // Would use kubernetes client-node
    // Placeholder implementation
    return [];
  }

  /**
   * Get services in a namespace
   */
  async getServices(namespace: string): Promise<KubernetesResource[]> {
    return [];
  }

  /**
   * Get ConfigMaps in a namespace
   */
  async getConfigMaps(namespace: string): Promise<KubernetesResource[]> {
    return [];
  }

  /**
   * Get Secrets in a namespace
   */
  async getSecrets(namespace: string): Promise<KubernetesResource[]> {
    return [];
  }

  /**
   * Get Ingresses in a namespace
   */
  async getIngresses(namespace: string): Promise<KubernetesResource[]> {
    return [];
  }

  /**
   * Get Helm releases
   */
  async getHelmReleases(namespace?: string): Promise<HelmRelease[]> {
    // Would use helm SDK or CLI
    return [];
  }

  /**
   * Convert Kubernetes Deployment to Docker Compose
   */
  deploymentToCompose(deployment: KubernetesResource): string {
    const spec = deployment.spec as DeploymentSpec;

    const services: Record<string, ComposeService> = {};
    const containerSpec = spec.template?.spec?.containers?.[0];

    if (containerSpec) {
      services[deployment.metadata.name] = {
        image: containerSpec.image || "",
        ports: containerSpec.ports?.map((p) => `${p.containerPort}:${p.containerPort}`) || [],
        environment: this.convertEnvVars(containerSpec.env || []),
        volumes: this.convertVolumeMounts(containerSpec.volumeMounts || [], spec.template?.spec?.volumes || []),
        deploy: {
          replicas: spec.replicas || 1,
        },
      };
    }

    return this.generateComposeYaml(services);
  }

  /**
   * Convert Helm chart to Docker Compose
   */
  async helmToCompose(release: HelmRelease): Promise<string> {
    // This would extract the rendered templates and convert them
    // Simplified implementation
    return `# Converted from Helm release: ${release.name}
# Chart: ${release.chart}:${release.version}
version: '3.8'
services:
  ${release.name}:
    image: placeholder
    # Values from Helm release need manual configuration
`;
  }

  /**
   * Convert ConfigMap to environment variables
   */
  configMapToEnv(configMap: KubernetesResource): Record<string, string> {
    const data = configMap.spec as Record<string, string>;
    return data || {};
  }

  /**
   * Convert Secret to environment variables (base64 decoded)
   */
  secretToEnv(secret: KubernetesResource, decode: boolean = true): Record<string, string> {
    const data = secret.spec as Record<string, string>;
    if (!data) return {};

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = decode ? Buffer.from(value, "base64").toString("utf-8") : value;
    }
    return result;
  }

  /**
   * Transform Kubernetes resources to Dokploy compose
   */
  transformToDokloy(
    resources: KubernetesResource[],
    namespaceMapping: NamespaceMapping[]
  ): DokployCompose[] {
    const composes: DokployCompose[] = [];

    // Group deployments by namespace
    const deployments = resources.filter((r) => r.kind === "Deployment");
    const services = resources.filter((r) => r.kind === "Service");
    const configMaps = resources.filter((r) => r.kind === "ConfigMap");
    const secrets = resources.filter((r) => r.kind === "Secret");

    // Create a compose for each deployment
    for (const deployment of deployments) {
      const namespace = deployment.metadata.namespace || "default";
      const mapping = namespaceMapping.find((m) => m.sourceNamespace === namespace);

      // Find related services
      const relatedServices = services.filter(
        (s) => s.metadata.namespace === namespace &&
          this.isServiceForDeployment(s, deployment)
      );

      // Find related configmaps and secrets
      const envFromConfigMaps = configMaps.filter(
        (cm) => cm.metadata.namespace === namespace
      );
      const envFromSecrets = secrets.filter(
        (s) => s.metadata.namespace === namespace
      );

      // Build compose file content
      const composeContent = this.buildComposeFromK8s(
        deployment,
        relatedServices,
        envFromConfigMaps,
        envFromSecrets
      );

      composes.push({
        name: deployment.metadata.name,
        composeFile: composeContent,
        sourceType: "raw",
        composeType: "docker-compose",
        environmentId: mapping?.targetEnvironment || "",
        serverId: undefined,
      });
    }

    return composes;
  }

  /**
   * Analyze Kubernetes resources for migration compatibility
   */
  analyzeCompatibility(resources: KubernetesResource[]): KubernetesAnalysis {
    const analysis: KubernetesAnalysis = {
      compatible: [],
      needsManualReview: [],
      incompatible: [],
      warnings: [],
    };

    for (const resource of resources) {
      const result = this.checkResourceCompatibility(resource);

      if (result.compatible) {
        analysis.compatible.push(resource);
      } else if (result.manualReview) {
        analysis.needsManualReview.push(resource);
        analysis.warnings.push(...result.warnings);
      } else {
        analysis.incompatible.push(resource);
        analysis.warnings.push(...result.warnings);
      }
    }

    return analysis;
  }

  // Private helper methods

  private isServiceForDeployment(
    service: KubernetesResource,
    deployment: KubernetesResource
  ): boolean {
    const serviceSpec = service.spec as { selector?: Record<string, string> };
    const deploymentLabels = deployment.metadata.labels || {};

    if (!serviceSpec.selector) return false;

    for (const [key, value] of Object.entries(serviceSpec.selector)) {
      if (deploymentLabels[key] !== value) return false;
    }

    return true;
  }

  private convertEnvVars(envVars: EnvVar[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const env of envVars) {
      if (env.value) {
        result[env.name] = env.value;
      }
    }
    return result;
  }

  private convertVolumeMounts(
    mounts: VolumeMount[],
    volumes: Volume[]
  ): string[] {
    const result: string[] = [];

    for (const mount of mounts) {
      const volume = volumes.find((v) => v.name === mount.name);
      if (volume?.persistentVolumeClaim) {
        result.push(`${mount.name}:${mount.mountPath}`);
      } else if (volume?.hostPath) {
        result.push(`${volume.hostPath.path}:${mount.mountPath}`);
      }
    }

    return result;
  }

  private buildComposeFromK8s(
    deployment: KubernetesResource,
    services: KubernetesResource[],
    configMaps: KubernetesResource[],
    secrets: KubernetesResource[]
  ): string {
    const spec = deployment.spec as DeploymentSpec;
    const containerSpec = spec.template?.spec?.containers?.[0];
    if (!containerSpec) return "";

    // Gather environment variables
    const environment: Record<string, string> = {};

    // From ConfigMaps
    for (const cm of configMaps) {
      Object.assign(environment, this.configMapToEnv(cm));
    }

    // From Secrets
    for (const secret of secrets) {
      Object.assign(environment, this.secretToEnv(secret));
    }

    // Find exposed ports from services
    const ports: string[] = [];
    for (const svc of services) {
      const svcSpec = svc.spec as { ports?: Array<{ port: number; targetPort?: number }> };
      for (const port of svcSpec.ports || []) {
        ports.push(`${port.port}:${port.targetPort || port.port}`);
      }
    }

    const composeServices: Record<string, ComposeService> = {
      [deployment.metadata.name]: {
        image: containerSpec.image || "",
        ports,
        environment,
        restart: "unless-stopped",
      },
    };

    return this.generateComposeYaml(composeServices);
  }

  private generateComposeYaml(services: Record<string, ComposeService>): string {
    let yaml = "version: '3.8'\n\nservices:\n";

    for (const [name, service] of Object.entries(services)) {
      yaml += `  ${name}:\n`;
      yaml += `    image: ${service.image}\n`;

      if (service.ports?.length) {
        yaml += `    ports:\n`;
        for (const port of service.ports) {
          yaml += `      - "${port}"\n`;
        }
      }

      if (Object.keys(service.environment || {}).length) {
        yaml += `    environment:\n`;
        for (const [key, value] of Object.entries(service.environment!)) {
          yaml += `      ${key}: "${value}"\n`;
        }
      }

      if (service.volumes?.length) {
        yaml += `    volumes:\n`;
        for (const vol of service.volumes) {
          yaml += `      - "${vol}"\n`;
        }
      }

      if (service.restart) {
        yaml += `    restart: ${service.restart}\n`;
      }

      yaml += "\n";
    }

    return yaml;
  }

  private checkResourceCompatibility(resource: KubernetesResource): {
    compatible: boolean;
    manualReview: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let compatible = true;
    let manualReview = false;

    // Check for unsupported features
    if (resource.kind === "StatefulSet") {
      manualReview = true;
      warnings.push(`StatefulSet '${resource.metadata.name}' requires manual review for state management`);
    }

    if (resource.kind === "DaemonSet") {
      compatible = false;
      warnings.push(`DaemonSet '${resource.metadata.name}' cannot be directly converted`);
    }

    if (resource.kind === "CronJob") {
      manualReview = true;
      warnings.push(`CronJob '${resource.metadata.name}' needs manual configuration`);
    }

    return { compatible, manualReview, warnings };
  }
}

// Type definitions
interface DeploymentSpec {
  replicas?: number;
  template?: {
    spec?: {
      containers?: ContainerSpec[];
      volumes?: Volume[];
    };
  };
}

interface ContainerSpec {
  name: string;
  image?: string;
  ports?: Array<{ containerPort: number }>;
  env?: EnvVar[];
  volumeMounts?: VolumeMount[];
}

interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: {
    configMapKeyRef?: { name: string; key: string };
    secretKeyRef?: { name: string; key: string };
  };
}

interface VolumeMount {
  name: string;
  mountPath: string;
}

interface Volume {
  name: string;
  persistentVolumeClaim?: { claimName: string };
  hostPath?: { path: string };
  configMap?: { name: string };
  secret?: { secretName: string };
}

interface ComposeService {
  image: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  restart?: string;
  deploy?: { replicas?: number };
}

interface KubernetesAnalysis {
  compatible: KubernetesResource[];
  needsManualReview: KubernetesResource[];
  incompatible: KubernetesResource[];
  warnings: string[];
}

// Export singleton
export const kubernetesAdapter = new KubernetesAdapter();
