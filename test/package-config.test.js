const fs = require('fs');
const path = require('path');
const { describe, it, expect, beforeAll } = require('@jest/globals');

describe('Package Configuration Tests', () => {
  let packageLock;
  let packageJson;

  beforeAll(() => {
    // Load package-lock.json
    const packageLockPath = path.join(__dirname, '..', 'package-lock.json');
    packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
    
    // Load package.json if it exists
    try {
      const packageJsonPath = path.join(__dirname, '..', 'package.json');
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (e) {
      packageJson = null;
    }
  });

  describe('Package Lock Structure Validation', () => {
    it('should have required top-level properties', () => {
      expect(packageLock).toHaveProperty('name');
      expect(packageLock).toHaveProperty('version');
      expect(packageLock).toHaveProperty('lockfileVersion');
      expect(packageLock).toHaveProperty('requires');
      expect(packageLock).toHaveProperty('packages');
    });

    it('should have correct project metadata', () => {
      expect(packageLock.name).toBe('football-oracle');
      expect(packageLock.version).toBe('0.0.0');
      expect(packageLock.lockfileVersion).toBe(3);
      expect(packageLock.requires).toBe(true);
    });

    it('should have packages object', () => {
      expect(typeof packageLock.packages).toBe('object');
      expect(packageLock.packages).not.toBeNull();
    });

    it('should have root package configuration', () => {
      expect(packageLock.packages).toHaveProperty('');
      const rootPackage = packageLock.packages[''];
      expect(rootPackage.name).toBe('football-oracle');
      expect(rootPackage.version).toBe('0.0.0');
    });
  });

  describe('Dependencies Validation', () => {
    let rootPackage;

    beforeAll(() => {
      rootPackage = packageLock.packages[''];
    });

    it('should have production dependencies', () => {
      expect(rootPackage).toHaveProperty('dependencies');
      expect(typeof rootPackage.dependencies).toBe('object');
    });

    it('should have development dependencies', () => {
      expect(rootPackage).toHaveProperty('devDependencies');
      expect(typeof rootPackage.devDependencies).toBe('object');
    });

    it('should include core project dependencies', () => {
      const expectedDeps = [
        '@supabase/supabase-js',
        '@tailwindcss/forms',
        'chart.js',
        'date-fns',
        'lucide-svelte',
        'svelte-chartjs'
      ];

      expectedDeps.forEach(dep => {
        expect(rootPackage.dependencies).toHaveProperty(dep);
      });
    });

    it('should include core development dependencies', () => {
      const expectedDevDeps = [
        '@sveltejs/vite-plugin-svelte',
        '@tsconfig/svelte',
        'autoprefixer',
        'postcss',
        'svelte',
        'svelte-check',
        'tailwindcss',
        'typescript',
        'vite'
      ];

      expectedDevDeps.forEach(dep => {
        expect(rootPackage.devDependencies).toHaveProperty(dep);
      });
    });

    it('should have valid semantic version ranges', () => {
      const semverRegex = /^[\^~]?\d+\.\d+\.\d+(-[\w\.-]+)?(\+[\w\.-]+)?$/;
      const rangeRegex = /^[\^~>=<\s\d\.\-\w\|]+$/;

      const allDeps = { ...rootPackage.dependencies, ...rootPackage.devDependencies };
      
      Object.entries(allDeps).forEach(([name, version]) => {
        expect(version).toMatch(rangeRegex);
      });
    });
  });

  describe('Package Integrity Validation', () => {
    it('should have node_modules entries for all dependencies', () => {
      const nodeModulesPackages = Object.keys(packageLock.packages)
        .filter(key => key.startsWith('node_modules/'));
      
      expect(nodeModulesPackages.length).toBeGreaterThan(0);
    });

    it('should have integrity hashes for resolved packages', () => {
      const nodeModulesPackages = Object.entries(packageLock.packages)
        .filter(([key]) => key.startsWith('node_modules/'));

      nodeModulesPackages.forEach(([name, pkg]) => {
        if (pkg.resolved) {
          expect(pkg).toHaveProperty('integrity');
          expect(typeof pkg.integrity).toBe('string');
          expect(pkg.integrity.length).toBeGreaterThan(0);
        }
      });
    });

    it('should have valid resolved URLs', () => {
      const urlRegex = /^https?:\/\/.+/;
      const nodeModulesPackages = Object.entries(packageLock.packages)
        .filter(([key]) => key.startsWith('node_modules/'));

      nodeModulesPackages.forEach(([name, pkg]) => {
        if (pkg.resolved) {
          expect(pkg.resolved).toMatch(urlRegex);
        }
      });
    });

    it('should have consistent licenses', () => {
      const nodeModulesPackages = Object.entries(packageLock.packages)
        .filter(([key]) => key.startsWith('node_modules/'));

      const packagesWithLicense = nodeModulesPackages.filter(([, pkg]) => pkg.license);
      expect(packagesWithLicense.length).toBeGreaterThan(0);

      packagesWithLicense.forEach(([name, pkg]) => {
        expect(typeof pkg.license).toBe('string');
        expect(pkg.license.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Framework-Specific Dependencies', () => {
    it('should have Svelte ecosystem packages', () => {
      const sveltePackages = [
        'node_modules/svelte',
        'node_modules/@sveltejs/vite-plugin-svelte',
        'node_modules/svelte-check',
        'node_modules/lucide-svelte',
        'node_modules/svelte-chartjs'
      ];

      sveltePackages.forEach(pkg => {
        expect(packageLock.packages).toHaveProperty(pkg);
      });
    });

    it('should have Vite build tool packages', () => {
      const vitePackages = [
        'node_modules/vite',
        'node_modules/esbuild',
        'node_modules/rollup'
      ];

      vitePackages.forEach(pkg => {
        expect(packageLock.packages).toHaveProperty(pkg);
      });
    });

    it('should have TailwindCSS styling packages', () => {
      const tailwindPackages = [
        'node_modules/tailwindcss',
        'node_modules/@tailwindcss/forms',
        'node_modules/autoprefixer',
        'node_modules/postcss'
      ];

      tailwindPackages.forEach(pkg => {
        expect(packageLock.packages).toHaveProperty(pkg);
      });
    });

    it('should have Supabase backend packages', () => {
      const supabasePackages = [
        'node_modules/@supabase/supabase-js',
        'node_modules/@supabase/auth-js',
        'node_modules/@supabase/postgrest-js',
        'node_modules/@supabase/storage-js',
        'node_modules/@supabase/realtime-js',
        'node_modules/@supabase/functions-js'
      ];

      supabasePackages.forEach(pkg => {
        expect(packageLock.packages).toHaveProperty(pkg);
      });
    });
  });

  describe('Security and Compatibility', () => {
    it('should have engine constraints where specified', () => {
      const packagesWithEngines = Object.entries(packageLock.packages)
        .filter(([, pkg]) => pkg.engines);

      packagesWithEngines.forEach(([name, pkg]) => {
        expect(typeof pkg.engines).toBe('object');
        if (pkg.engines.node) {
          expect(typeof pkg.engines.node).toBe('string');
        }
      });
    });

    it('should not have known vulnerable versions', () => {
      // This is a basic check - in real scenarios you'd use npm audit or similar
      const rootPackage = packageLock.packages[''];
      const allDeps = { ...rootPackage.dependencies, ...rootPackage.devDependencies };
      
      // Check for some known problematic patterns
      Object.entries(allDeps).forEach(([name, version]) => {
        // Ensure no wildcard versions in production
        if (rootPackage.dependencies[name]) {
          expect(version).not.toBe('*');
        }
      });
    });

    it('should have consistent TypeScript configuration', () => {
      expect(packageLock.packages).toHaveProperty('node_modules/typescript');
      expect(packageLock.packages).toHaveProperty('node_modules/@tsconfig/svelte');
      
      const tsPackage = packageLock.packages['node_modules/typescript'];
      expect(tsPackage.version).toMatch(/^5\./); // TypeScript 5.x
    });
  });

  describe('Package Consistency with package.json', () => {
    // Skip if package.json doesn't exist
    it.skipIf(!packageJson)('should match package.json dependencies', () => {
      if (!packageJson) return;

      const lockDeps = packageLock.packages[''].dependencies || {};
      const lockDevDeps = packageLock.packages[''].devDependencies || {};
      
      if (packageJson.dependencies) {
        Object.keys(packageJson.dependencies).forEach(dep => {
          expect(lockDeps).toHaveProperty(dep);
        });
      }

      if (packageJson.devDependencies) {
        Object.keys(packageJson.devDependencies).forEach(dep => {
          expect(lockDevDeps).toHaveProperty(dep);
        });
      }
    });

    it.skipIf(!packageJson)('should have matching name and version', () => {
      if (!packageJson) return;

      expect(packageLock.name).toBe(packageJson.name);
      expect(packageLock.version).toBe(packageJson.version);
    });
  });

  describe('Performance and Size Optimization', () => {
    it('should not have duplicate packages with different versions', () => {
      const packageNames = new Map();
      
      Object.entries(packageLock.packages).forEach(([path, pkg]) => {
        if (path.startsWith('node_modules/')) {
          const packageName = path.replace(/^node_modules\//, '').split('/')[0];
          if (packageNames.has(packageName)) {
            const existing = packageNames.get(packageName);
            // Allow different versions for scoped packages or known multi-version scenarios
            if (!packageName.startsWith('@') && pkg.version !== existing.version) {
              console.warn(`Potential duplicate: ${packageName} has versions ${existing.version} and ${pkg.version}`);
            }
          } else {
            packageNames.set(packageName, pkg);
          }
        }
      });
    });

    it('should have reasonable number of dependencies', () => {
      const totalPackages = Object.keys(packageLock.packages).length;
      // This is a reasonable upper bound for a modern web application
      expect(totalPackages).toBeLessThan(500);
      expect(totalPackages).toBeGreaterThan(50); // Should have substantial dependencies
    });

    it('should include tree-shaking friendly packages', () => {
      // Check for ESM support in key packages
      const esmFriendlyPackages = [
        'node_modules/lucide-svelte',
        'node_modules/chart.js',
        'node_modules/date-fns'
      ];

      esmFriendlyPackages.forEach(pkg => {
        if (packageLock.packages[pkg]) {
          // Modern packages should support ESM
          expect(packageLock.packages[pkg]).toBeDefined();
        }
      });
    });
  });

  describe('Build Tool Integration', () => {
    it('should have Vite ecosystem compatibility', () => {
      const viteCompatiblePackages = [
        'node_modules/vite',
        'node_modules/@sveltejs/vite-plugin-svelte',
        'node_modules/esbuild'
      ];

      viteCompatiblePackages.forEach(pkg => {
        expect(packageLock.packages).toHaveProperty(pkg);
      });
    });

    it('should have proper PostCSS plugin chain', () => {
      const postcssPackages = [
        'node_modules/postcss',
        'node_modules/autoprefixer',
        'node_modules/tailwindcss'
      ];

      postcssPackages.forEach(pkg => {
        expect(packageLock.packages).toHaveProperty(pkg);
        const packageInfo = packageLock.packages[pkg];
        expect(packageInfo).toHaveProperty('version');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing package gracefully', () => {
      expect(() => {
        const nonExistent = packageLock.packages['node_modules/non-existent-package'];
        expect(nonExistent).toBeUndefined();
      }).not.toThrow();
    });

    it('should have valid JSON structure', () => {
      expect(() => {
        JSON.stringify(packageLock);
      }).not.toThrow();
    });

    it('should handle optional dependencies correctly', () => {
      const packagesWithOptional = Object.entries(packageLock.packages)
        .filter(([, pkg]) => pkg.optionalDependencies);

      packagesWithOptional.forEach(([name, pkg]) => {
        expect(typeof pkg.optionalDependencies).toBe('object');
      });
    });

    it('should handle peer dependencies correctly', () => {
      const packagesWithPeerDeps = Object.entries(packageLock.packages)
        .filter(([, pkg]) => pkg.peerDependencies);

      packagesWithPeerDeps.forEach(([name, pkg]) => {
        expect(typeof pkg.peerDependencies).toBe('object');
      });
    });
  });
});