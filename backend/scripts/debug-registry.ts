
import { toolRegistry } from '../src/services/ai/tools/registry';
// Import the tools index to trigger registration
import '../src/services/ai/tools';

console.log('🔍 Debugging Tool Registry...');

const tools = toolRegistry.getAll();
console.log(`\nFound ${tools.length} registered tools:`);

tools.forEach(tool => {
    console.log(`- [${tool.category}] ${tool.name} (Confirmation: ${tool.requiresConfirmation})`);
});

const jiraTool = toolRegistry.get('jira_create_issue');
if (jiraTool) {
    console.log('\n✅ "jira_create_issue" is registered correctly.');
} else {
    console.error('\n❌ "jira_create_issue" is MISSING from registry!');
}
