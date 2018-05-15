## Functions

<dl>
<dt><a href="#loadSprintDataUsingSavedConfig">loadSprintDataUsingSavedConfig()</a></dt>
<dd><p>Loads configuration from <code>config</code> folder, then delegates to
<code>getAllTheSprints</code> function to asquire sprints metadata.</p>
</dd>
<dt><a href="#fillApiConfigWithData">fillApiConfigWithData(data)</a></dt>
<dd><p>Fills <code>apiConfig</code> (empty object stored in a global variable) with
sensitive data (api tokens and so on) from config files.</p>
</dd>
<dt><a href="#getAllTheSprints">getAllTheSprints()</a></dt>
<dd></dd>
<dt><a href="#getSprintDataFrom">getSprintDataFrom(sprintCard)</a> ⇒ <code>Sprint</code></dt>
<dd><p>Parses provided <code>TrelloCard</code> and creates valid Sprint object based on that card
custom fields</p>
</dd>
</dl>

<a name="loadSprintDataUsingSavedConfig"></a>

## loadSprintDataUsingSavedConfig()
Loads configuration from `config` folder, then delegates to`getAllTheSprints` function to asquire sprints metadata.

**Kind**: global function  
<a name="fillApiConfigWithData"></a>

## fillApiConfigWithData(data)
Fills `apiConfig` (empty object stored in a global variable) withsensitive data (api tokens and so on) from config files.

**Kind**: global function  

| Param | Type |
| --- | --- |
| data | <code>Object</code> | 

<a name="getAllTheSprints"></a>

## getAllTheSprints()
**Kind**: global function  
<a name="getSprintDataFrom"></a>

## getSprintDataFrom(sprintCard) ⇒ <code>Sprint</code>
Parses provided `TrelloCard` and creates valid Sprint object based on that cardcustom fields

**Kind**: global function  
**Returns**: <code>Sprint</code> - sprint general info  

| Param | Type |
| --- | --- |
| sprintCard | <code>TrelloCard</code> | 

