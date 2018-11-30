# Supporting Project Config

If your plugin has any configurable components that store settings outside of your main [plugin settings](plugin-settings.md), they may be good candidates for [project config](../project-config.md) support.

## Is Project Config Support Right for You?

Before adding project config support to your component, consider the tradeoff: components that are managed by the project config [should](../project-config.md#production-changes-may-be-forgotten) only be editable by admins on development environments.

Ask yourself:

- Can this component be managed by non-admins?
- Does it depend on anything that can be managed by non-admins?
- Would it be cumbersome to admins’ workflows if the component could only be edited in development environments?

If the answer to any of those is “yes” (now or in the foreseeable future), then it’s not a good candidate for project config support.

## Implementing Project Config Support

To add project config support to a plugin, the service’s CRUD code will need to be shifted around a bit.

- CRUD methods should update the Project Config, rather than changing things in the database directly.
- Database changes should only happen as a result of changes to the Project Config.

Let’s take a look at how that might work for saving product types in Craft Commerce.

### Step 1: Listen for Config Changes

From your plugin’s `init()` method, use <api:craft\services\ProjectConfig::onAdd()>, [onUpdate()](api:craft\services\ProjectConfig::onUpdate()), and [onRemove()](api:craft\services\ProjectConfig::onRemove()) to register event listeners that are triggered when product types are added, updated, and removed from the project config.

```php
use craft\events\ConfigEvent;
use craft\services\ProjectConfig;

public function init()
{
    parent::init();

    Craft::$app->projectConfig
        ->onAdd('productTypes.{uid}', [$this->productTypes, 'handleChangedProductType'])
        ->onUpdate('productTypes.{uid}', [$this->productTypes, 'handleChangedProductType'])
        ->onRemove('productTypes.{uid}', [$this->productTypes, 'handleDeletedProductType']);
}
```

::: tip
`{uid}` is a special config path token that will match any valid UID (such as ones generated by [StringHelper::UUID()](api:craft\helpers\StringHelper::UUID())). When an event handler is called, if the path contained a `{uid}` token, the matching UID will be available via [ConfigEvent::$tokenMatches](api:craft\events\ConfigEvent::$tokenMatches).
:::

### Step 2: Handle Config Changes

Now add the `handleChangedProductType()` and `handleDeletedProductType()` methods we’re referencing in our config event listeners.

These functions are responsible for making database changes, based on the project config.

```php
use Craft;
use craft\db\Query;
use craft\events\ConfigEvent;

public function handleChangedProductType(ConfigEvent $event)
{
    // Get the UID that was matched in the config path
    $uid = $event->tokenMatches[0];
    
    // Does this product type exist?
    $id = (new Query())
        ->select(['id'])
        ->from('{{%producttypes}}')
        ->where(['uid' => $uid])
        ->scalar();

    $isNew = empty($id);

    // Insert or update its row
    if ($isNew) {
        Craft::$app->db->createCommand()
            ->insert('{{%producttypes}}', [
                'name' => $event->newValue['name'],
                // ...
            ])
            ->execute();
    } else {
        Craft::$app->db->createCommand()
            ->update('{{%producttypes}}', [
                'name' => $event->newValue['name'],
                // ...
            ], ['id' => $id])
            ->execute();
    }

    // Fire an 'afterSaveProductType' event?
    if ($this->hasEventHandlers('afterSaveProductType')) {
        $productType = $this->getProductTypeByUid($uid);
        $this->trigger('afterSaveProductType', new ProducTypeEvent([
            'productType' => $productType,
            'isNew' => $isNew,
        ]));
    }
}

public function handleDeletedProductType(ConfigEvent $event)
{
    // Get the UID that was matched in the config path
    $uid = $event->tokenMatches[0];

    // Get the product type
    $productType = $this->getProductTypeByUid($uid);

    // If that came back empty, we're done!
    if (!$productType) {
        return;
    }

    // Fire a 'beforeApplyProductTypeDelete' event?
    if ($this->hasEventHandlers('beforeApplyProductTypeDelete')) {
        $this->trigger('beforeApplyProductTypeDelete', new ProducTypeEvent([
            'productType' => $productType,
        ]));
    }

    // Delete its row
    Craft::$app->db->createCommand()
        ->delete('{{%producttypes}}', ['id' => $productType->id])
        ->execute();

    // Fire an 'afterDeleteProductType' event?
    if ($this->hasEventHandlers('afterDeleteProductType')) {
        $this->trigger('afterDeleteProductType', new ProducTypeEvent([
            'productType' => $productType,
        ]));
    }
}
```

At this point, if product types were to be added or removed from the project config manually, those changes should be syncing with the database, and any `afterSaveProductType`, `beforeApplyProductTypeDelete`, and `afterDeleteProductType` event listeners will be triggered. 

::: tip
If your component config references another component config, you can ensure that the other config changes are processed first by calling [ProjectConfig::processConfigChanges()](api:craft\services\ProjectConfig::processConfigChanges()) within your handler method.

```php
Craft::$app->projectConfig->processConfigChanges('productTypeGroups');
```
:::

### Step 3: Push Changes to the Config

Now all that’s left is to update your service methods so that they update the project config rather than updating the database.

Items in the project config can be added or updated using <api:craft\services\ProjectConfig::set()>, and removed using [remove()](api:craft\services\ProjectConfig::remove()).

```php
use Craft;
use craft\helpers\Db;
use craft\helpers\StringHelper;

public function saveProductType($productType)
{
    $isNew = empty($productType->id);

    // Ensure the product type has a UID
    if ($isNew) {
        $productType->uid = StringHelper::UUID();
    } else if (!$productType->uid) {
        $productType->uid = Db::uidById('{{%producttypes}}', $productType->id);
    }

    // Fire a 'beforeSaveProductType' event?
    if ($this->hasEventHandlers('beforeSaveProductType')) {
        $this->trigger('beforeSaveProductType', new ProducTypeEvent([
            'productType' => $productType,
            'isNew' => $isNew,
        ]));
    }

    // Make sure it validates
    if (!$productType->validate()) {
        return false;
    }

    // Save it to the project config
    $path = "product-types.{$productType->uid}";
    Craft::$app->projectConfig->set($path, [
        'name' => $productType->name,
        // ...
    ]);

    // Now set the ID on the product type in case the
    // caller needs to know it
    if ($isNew) {
        $productType->id = Db::idByUid('{{%producttypes}}', $productType->uid);
    }

    return true;
}

public function deleteProductType($productType)
{
    // Fire a 'beforeDeleteProductType' event?
    if ($this->hasEventHandlers('beforeDeleteProductType')) {
        $this->trigger('beforeDeleteProductType', new ProducTypeEvent([
            'productType' => $productType,
        ]));
    }

    // Remove it from the project config
    $path = "product-types.{$productType->uid}";
    Craft::$app->projectConfig->remove($path);
}
```

## Project Config Migrations

You can add, update, and remove items from the project config from your plugin’s [migrations](migrations.md). It’s slightly more complicated than database changes though, because there’s a chance that the same migration has already run on the same config in a different environment.

Consider this scenario:

1. Your plugin is updated on Environment A, which includes a new migration that makes a change to the project config.
3. The updated `composer.lock` and `project.yaml` is committed to Git.
4. The Git commit is pulled into Environment B, where Craft must now run the new plugin migration _and_ sync `project.yaml` changes.

When new plugin migrations are pending _and_ `project.yaml` changes are pending, Craft will run migrations first and then sync the `project.yaml` changes.

If your plugin migration were to make the same project config changes again on Environment B, those changes will conflict with the pending changes in `project.yaml`.

To avoid this, always check your plugin’s schema version _in `project.yaml`_ before making project config changes. (You do that by passing `true` as the second argument when calling [ProjectConfig::get()](api:craft\services\ProjectConfig::get()).)

```php
public function safeUp()
{
    // Don't make the same config changes twice
    $schemaVersion = Craft::$app->projectConfig
        ->get('plugins.<plugin-handle>.schemaVersion', true);

    if (version_compare($schemaVersion, '<NewSchemaVersion>', '<')) {
        // Make the config changes here...
    }
}
```