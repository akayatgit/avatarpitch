import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const contentTypeId = resolvedParams.id;

    const { data: contentType, error } = await supabaseAdmin
      .from('content_types')
      .select('*')
      .eq('id', contentTypeId)
      .single();

    if (error || !contentType) {
      console.error('[API] Content type not found:', { contentTypeId, error });
      return NextResponse.json({ error: 'Content type not found' }, { status: 404 });
    }

    // Handle potential JSON string parsing
    let inputsContract = contentType.inputs_contract;
    if (typeof inputsContract === 'string') {
      try {
        inputsContract = JSON.parse(inputsContract);
        console.log('[API] Parsed inputs_contract from string');
      } catch (e) {
        console.error('[API] Failed to parse inputs_contract:', e);
      }
    }

    console.log('[API] Raw database data:', {
      id: contentType.id,
      name: contentType.name,
      hasInputsContract: !!inputsContract,
      inputsContractType: typeof inputsContract,
      inputsContractIsString: typeof contentType.inputs_contract === 'string',
      inputsContractKeys: inputsContract ? Object.keys(inputsContract) : [],
      inputsContractFields: inputsContract?.fields,
      fieldsLength: inputsContract?.fields?.length,
      fieldsIsArray: Array.isArray(inputsContract?.fields),
      fullInputsContract: JSON.stringify(inputsContract, null, 2),
      rawInputsContractType: typeof contentType.inputs_contract,
      rawInputsContractValue: contentType.inputs_contract
    });

    // Convert database structure to ContentTypeDefinition format
    const contentTypeDefinition = {
      id: contentType.id,
      name: contentType.name,
      category: contentType.category,
      description: contentType.description,
      version: contentType.version,
      outputContract: contentType.output_contract,
      sceneGenerationPolicy: contentType.scene_generation_policy,
      inputsContract: inputsContract,
      prompting: contentType.prompting,
    };

    console.log('[API] Returning contentTypeDefinition:', {
      name: contentTypeDefinition.name,
      inputsContractFieldsLength: contentTypeDefinition.inputsContract?.fields?.length,
      inputsContract: JSON.stringify(contentTypeDefinition.inputsContract, null, 2)
    });

    return NextResponse.json({ contentType: contentTypeDefinition });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch content type' },
      { status: 500 }
    );
  }
}

