#!/usr/bin/env node
// Simplified template deployment test (Node.js compatible)
const fs = require('fs').promises;
const path = require('path');

// Template variables that should be replaced
const TEMPLATE_VARIABLES = [
  'COMPANY_NAME',
  'COMPANY_DOMAIN', 
  'COMPANY_DESCRIPTION',
  'PRODUCT_NAME',
  'PRODUCT_LATEST_VERSION',
  'PRODUCT_ABBREVIATION',
  'SUPPORT_EMAIL',
  'SUPPORT_URL',
  'TECHNICAL_SUPPORT_URL',
  'PRODUCTION_URL',
  'PINECONE_INDEX_NAME'
];

// Key files that should contain template variables
const TEMPLATE_FILES = [
  'config/template.ts',        // Main template configuration
  'config/pinecone.ts',        // Database configuration  
  'README.md',                 // Documentation
  'components/core/Chat/ChatContainer.tsx'  // UI components
];

function findTemplateVariables(content) {
  const pattern = /\{\{([A-Z_]+)\}\}/g;
  const matches = [];
  let match;
  
  while ((match = pattern.exec(content)) !== null) {
    matches.push(match[1]);
  }
  
  return [...new Set(matches)]; // Remove duplicates
}

function replaceTemplateVariables(content, variableMap) {
  let result = content;
  
  for (const [variable, value] of Object.entries(variableMap)) {
    const pattern = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
    result = result.replace(pattern, value);
  }
  
  return result;
}

async function runSimplifiedTest() {
  console.log('🧪 Starting ChatFactoryTemplate validation test...\n');

  try {
    // Test configuration
    const testConfig = {
      COMPANY_NAME: "Test Company",
      COMPANY_DOMAIN: "testcompany.com",
      COMPANY_DESCRIPTION: "test software",
      PRODUCT_NAME: "TestCAM",
      PRODUCT_LATEST_VERSION: "2024",
      PRODUCT_ABBREVIATION: "TCAM",
      SUPPORT_EMAIL: "support@testcompany.com",
      SUPPORT_URL: "https://testcompany.com/support",
      TECHNICAL_SUPPORT_URL: "https://testcompany.com/technical-support",
      PRODUCTION_URL: "https://chat.testcompany.com/",
      PINECONE_INDEX_NAME: "testcompany-knowledge-base"
    };

    console.log('1️⃣ Testing template variable detection and replacement...');
    
    let totalFilesProcessed = 0;
    let totalVariablesFound = 0;
    let totalReplacements = 0;
    const unreplacedVariables = new Set();

    // Process each template file
    for (const filePath of TEMPLATE_FILES) {
      try {
        const fullPath = path.join(__dirname, filePath);
        const content = await fs.readFile(fullPath, 'utf8');
        totalFilesProcessed++;
        
        // Find template variables in original content
        const originalVariables = findTemplateVariables(content);
        totalVariablesFound += originalVariables.length;
        
        if (originalVariables.length > 0) {
          console.log(`   📄 ${filePath}: Found ${originalVariables.length} variables: ${originalVariables.join(', ')}`);
        }
        
        // Test replacement
        const processedContent = replaceTemplateVariables(content, testConfig);
        const remainingVariables = findTemplateVariables(processedContent);
        
        const replacements = originalVariables.length - remainingVariables.length;
        totalReplacements += replacements;
        
        if (remainingVariables.length > 0) {
          console.log(`   ⚠️  ${filePath}: ${remainingVariables.length} variables not replaced: ${remainingVariables.join(', ')}`);
          remainingVariables.forEach(v => unreplacedVariables.add(v));
        } else if (originalVariables.length > 0) {
          console.log(`   ✅ ${filePath}: All ${originalVariables.length} variables successfully replaced`);
        }
        
      } catch (error) {
        console.log(`   ⚠️  Could not process ${filePath}: ${error.message}`);
      }
    }

    console.log(`\n2️⃣ Testing results summary:`);
    console.log(`   • Files processed: ${totalFilesProcessed}`);
    console.log(`   • Template variables found: ${totalVariablesFound}`);
    console.log(`   • Successful replacements: ${totalReplacements}`);
    console.log(`   • Unreplaced variables: ${unreplacedVariables.size}`);

    if (unreplacedVariables.size > 0) {
      console.log(`   ❌ The following variables were not replaced: ${Array.from(unreplacedVariables).join(', ')}`);
    }

    // Test specific file contents
    console.log('\n3️⃣ Testing critical file content...');
    
    const criticalTests = [
      {
        file: 'config/template.ts',
        shouldContain: 'TestCAM',
        description: 'Template config should contain replaced product name'
      },
      {
        file: 'config/template.ts',
        shouldContain: 'Test Company',
        description: 'Template config should contain replaced company name'
      },
      {
        file: 'config/pinecone.ts',
        shouldContain: 'testcompany-knowledge-base',
        description: 'Pinecone config should contain replaced index name'
      }
    ];

    let testsPassed = 0;
    for (const test of criticalTests) {
      try {
        const fullPath = path.join(__dirname, test.file);
        const content = await fs.readFile(fullPath, 'utf8');
        const processedContent = replaceTemplateVariables(content, testConfig);
        
        if (processedContent.includes(test.shouldContain)) {
          console.log(`   ✅ ${test.description}`);
          testsPassed++;
        } else {
          console.log(`   ❌ ${test.description} - "${test.shouldContain}" not found after replacement`);
        }
      } catch (error) {
        console.log(`   ❌ ${test.description} - Could not test: ${error.message}`);
      }
    }

    // Final assessment
    const success = unreplacedVariables.size === 0 && testsPassed === criticalTests.length;
    
    console.log('\n🎯 Final Assessment:');
    if (success) {
      console.log('✅ TEMPLATE VALIDATION PASSED');
      console.log('🚀 Template is ready for production deployment!');
      console.log('\n📊 Summary:');
      console.log(`   • All ${totalReplacements} template variables can be replaced successfully`);
      console.log(`   • All critical content tests passed`);
      console.log(`   • Template system is fully functional`);
    } else {
      console.log('❌ TEMPLATE VALIDATION FAILED');
      if (unreplacedVariables.size > 0) {
        console.log(`   • ${unreplacedVariables.size} variables could not be replaced`);
      }
      if (testsPassed < criticalTests.length) {
        console.log(`   • ${criticalTests.length - testsPassed} critical content tests failed`);
      }
    }

    return success;

  } catch (error) {
    console.error(`\n❌ Test failed with error: ${error.message}`);
    return false;
  }
}

// Run the test
if (require.main === module) {
  runSimplifiedTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runSimplifiedTest };