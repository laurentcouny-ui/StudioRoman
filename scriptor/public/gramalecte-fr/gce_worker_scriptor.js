/* Scriptor — worker Gramalecte (GPL-3.0, fichiers issus de l’XPI officiel) */
"use strict";
importScripts("regExp-leftContext-polyfill.js");
importScripts("grammalecte/graphspell/helpers.js");
importScripts("grammalecte/graphspell/str_transform.js");
importScripts("grammalecte/graphspell/char_player.js");
importScripts("grammalecte/graphspell/lexgraph_fr.js");
importScripts("grammalecte/graphspell/ibdawg.js");
importScripts("grammalecte/graphspell/spellchecker.js");
importScripts("grammalecte/text.js");
importScripts("grammalecte/graphspell/tokenizer.js");
importScripts("grammalecte/fr/conj.js");
importScripts("grammalecte/fr/mfsp.js");
importScripts("grammalecte/fr/phonet.js");
importScripts("grammalecte/fr/thesaurus.js");
importScripts("grammalecte/fr/cregex.js");
importScripts("grammalecte/fr/gc_options.js");
importScripts("grammalecte/fr/gc_functions.js");
importScripts("grammalecte/fr/gc_rules.js");
importScripts("grammalecte/fr/gc_rules_graph.js");
importScripts("grammalecte/fr/gc_engine.js");
importScripts("grammalecte/tests.js");

function createResponse (sActionDone, result, oInfo, bEnd, bError=false) {
    return {
        "sActionDone": sActionDone,
        "result": result,
        "oInfo": oInfo,
        "bEnd": bEnd,
        "bError": bError
    };
}

function createErrorResult (e, sDescr) {
    return {
        "sType": "error",
        "sDescription": sDescr || "no description",
        "sMessage": (e && (e.message || String(e))) || "error"
    };
}

let bInitDone = false;
let oSpellChecker = null;
let oTokenizer = null;
let oTest = null;

function init (sExtensionPath, dOptions, sContext, oInfo) {
    sContext = sContext || "JavaScript";
    dOptions = dOptions === undefined ? null : dOptions;
    oInfo = oInfo || {};
    try {
        if (!bInitDone) {
            conj.init(helpers.loadFile(sExtensionPath + "/grammalecte/fr/conj_data.json"));
            phonet.init(helpers.loadFile(sExtensionPath + "/grammalecte/fr/phonet_data.json"));
            mfsp.init(helpers.loadFile(sExtensionPath + "/grammalecte/fr/mfsp_data.json"));
            thesaurus.init(
                helpers.loadFile(sExtensionPath + "/grammalecte/fr/thesaurus1_data.json"),
                helpers.loadFile(sExtensionPath + "/grammalecte/fr/thesaurus2_data.json")
            );
            gc_engine.load(sContext, "aHSL", sExtensionPath + "grammalecte/graphspell/_dictionaries");
            oSpellChecker = gc_engine.getSpellChecker();
            oTest = new TestGrammarChecking(gc_engine, sExtensionPath + "/grammalecte/fr/tests_data.json");
            oTokenizer = new Tokenizer("fr");
            if (dOptions !== null) {
                if (!(dOptions instanceof Map)) {
                    dOptions = helpers.objectToMap(dOptions);
                }
                gc_engine.setOptions(dOptions);
            }
            bInitDone = true;
        }
        dOptions = helpers.mapToObject(gc_engine.getOptions());
        postMessage(createResponse("init", dOptions, oInfo, true));
    }
    catch (e) {
        console.error(e);
        postMessage(createResponse("init", createErrorResult(e, "init failed"), oInfo, true, true));
    }
}

function parse (sText, sCountry, bDebug, bContext, oInfo) {
    oInfo = oInfo || {};
    sText = String(sText).replace(/\u00ad/gi, "").replace(/\u2011/g, "-").normalize("NFC");
    for (let sParagraph of text.getParagraph(sText)) {
        let aGrammErr = gc_engine.parse(sParagraph, sCountry, bDebug, bContext);
        postMessage(createResponse("parse", aGrammErr, oInfo, false));
    }
    postMessage(createResponse("parse", null, oInfo, true));
}

onmessage = function (e) {
    let {sCommand, oParam, oInfo} = e.data;
    switch (sCommand) {
        case "init":
            init(oParam.sExtensionPath, oParam.dOptions, oParam.sContext, oInfo);
            break;
        case "parse":
            parse(oParam.sText, oParam.sCountry, oParam.bDebug, oParam.bContext, oInfo);
            break;
        default:
            console.log("[Scriptor Grammalecte worker] unknown:", sCommand);
    }
};
