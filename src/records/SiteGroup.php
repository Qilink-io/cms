<?php
/**
 * @link      https://craftcms.com/
 * @copyright Copyright (c) Pixel & Tonic, Inc.
 * @license   https://craftcms.github.io/license/
 */

namespace craft\records;

use craft\db\ActiveRecord;
use yii\db\ActiveQueryInterface;

/**
 * SiteGroup record.
 *
 * @property int $id    ID
 * @property string $name  Name
 * @property Site[] $sites Sites
 * @author Pixel & Tonic, Inc. <support@pixelandtonic.com>
 * @since  3.0
 */
class SiteGroup extends ActiveRecord
{
    // Public Methods
    // =========================================================================

    /**
     * @inheritdoc
     * @return string
     */
    public static function tableName(): string
    {
        return '{{%sitegroups}}';
    }

    /**
     * Returns the site group’s sites.
     *
     * @return ActiveQueryInterface The relational query object.
     */
    public function getSites(): ActiveQueryInterface
    {
        return $this->hasMany(Site::class, ['siteId' => 'id']);
    }
}
