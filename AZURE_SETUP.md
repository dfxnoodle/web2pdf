# Azure OpenAI Configuration Guide

This guide will help you set up Azure OpenAI for the Web2PDF application.

## Step 1: Create Azure OpenAI Resource

1. Go to the [Azure Portal](https://portal.azure.com)
2. Click "Create a resource"
3. Search for "OpenAI" and select "Azure OpenAI"
4. Click "Create"
5. Fill in the required details:
   - **Subscription**: Your Azure subscription
   - **Resource Group**: Create new or select existing
   - **Region**: Choose a region that supports OpenAI (e.g., East US, West Europe)
   - **Name**: Give your resource a unique name
   - **Pricing Tier**: Select appropriate tier

## Step 2: Deploy a Model

1. Once your Azure OpenAI resource is created, go to the resource
2. Click on "Model deployments" in the left sidebar
3. Click "Create new deployment"
4. Choose a model:
   - **Recommended**: `gpt-35-turbo` or `gpt-4`
   - **Deployment name**: Give it a name (e.g., "gpt-35-turbo-web2pdf")
5. Click "Create"

## Step 3: Get Your Credentials

1. In your Azure OpenAI resource, go to "Keys and Endpoint"
2. Copy the following information:
   - **Key 1** (your API key)
   - **Endpoint** (the URL ending with .openai.azure.com/)
   - **Deployment name** (from the previous step)

## Step 4: Configure Environment Variables

Update your `.env.local` file with your Azure OpenAI credentials:

```env
# Replace these with your actual values
AZURE_OPENAI_API_KEY=your_api_key_from_step_3
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name-from-step_2
AZURE_OPENAI_API_VERSION=2024-02-01
```

### Example Configuration

```env
AZURE_OPENAI_API_KEY=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
AZURE_OPENAI_ENDPOINT=https://my-openai-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-35-turbo-web2pdf
AZURE_OPENAI_API_VERSION=2024-02-01
```

## Step 5: Test Your Configuration

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000)

3. Try the following:
   - Enter some content in the editor
   - Click "Structure Content" to test AI integration
   - Click "Improve with AI" to test typesetting

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check your API key is correct
   - Ensure your Azure subscription is active

2. **404 Not Found**
   - Verify your endpoint URL is correct
   - Check your deployment name matches exactly

3. **429 Rate Limited**
   - You've exceeded your quota
   - Wait a few minutes or upgrade your tier

4. **Model Not Available**
   - The model isn't deployed in your region
   - Try a different region or model

### Testing Your Setup

You can test your Azure OpenAI connection using curl:

```bash
curl -X POST \
  "https://your-resource-name.openai.azure.com/openai/deployments/your-deployment-name/chat/completions?api-version=2024-02-01" \
  -H "Content-Type: application/json" \
  -H "api-key: your-api-key" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Hello, this is a test."
      }
    ],
    "max_tokens": 50
  }'
```

If successful, you should receive a JSON response with the AI's reply.

## Best Practices

1. **Security**: Never commit your API keys to version control
2. **Rate Limits**: Be mindful of API quotas and implement retry logic
3. **Error Handling**: Always handle potential API errors gracefully
4. **Monitoring**: Monitor your Azure OpenAI usage in the Azure portal

## Need Help?

- [Azure OpenAI Documentation](https://docs.microsoft.com/en-us/azure/cognitive-services/openai/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Azure Support](https://azure.microsoft.com/en-us/support/)
